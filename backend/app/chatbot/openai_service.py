"""Thin, provider-specific wrapper around the OpenAI Chat Completions API.

This module owns everything that is specific to talking to OpenAI: client
construction, translating `ChatbotTools` methods into OpenAI tool schemas,
and running the manual tool-calling loop. `app/chatbot/service.py` is the
provider-agnostic orchestrator (conversation history, system prompt,
response shaping) and should not import anything from the `openai` package
directly - that keeps a future provider swap contained to this file.
"""
import inspect
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, get_type_hints

import pydantic
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# A single chat turn can legitimately need several tool round-trips (e.g.
# check availability, then resolve_booking_conflict, then confirm_intent_to_book).
# This bounds it so a confused model can't loop forever burning API calls.
MAX_TOOL_ITERATIONS = 8

# The OpenAI SDK requests time out and are retried internally by default,
# but both are configured explicitly so a hung request surfaces as a clear,
# handleable timeout instead of blocking the chat request indefinitely.
REQUEST_TIMEOUT_SECONDS = 30.0
MAX_SDK_RETRIES = 2


class OpenAIConfigError(RuntimeError):
    """Raised when OPENAI_API_KEY is missing or blank at request time."""


def get_client() -> AsyncOpenAI:
    """Build an AsyncOpenAI client from server-side settings only.

    Raises OpenAIConfigError with a clear, actionable message if the key
    isn't configured - callers turn this into a friendly in-chat message
    rather than a raw 500, but it's still logged loudly server-side so a
    misconfigured deployment is obvious from the logs.
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise OpenAIConfigError(
            "OPENAI_API_KEY is not configured. Set OPENAI_API_KEY in the root .env "
            "file and restart the backend to enable the AI assistant."
        )
    return AsyncOpenAI(
        api_key=api_key,
        # Blank means api.openai.com (the SDK's own default); set OPENAI_BASE_URL to
        # point at any OpenAI-compatible gateway (e.g. OpenRouter) instead.
        base_url=settings.OPENAI_BASE_URL or None,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=MAX_SDK_RETRIES,
    )


def build_tool_schema(func: Callable) -> Dict[str, Any]:
    """Derive an OpenAI `tools` function-schema entry from a bound method's
    signature and docstring - so every ChatbotTools method automatically
    becomes a callable tool without hand-writing 20+ JSON schemas by hand
    (and without them drifting out of sync with the actual Python signature).
    """
    sig = inspect.signature(func)
    hints = get_type_hints(func)
    fields: Dict[str, Any] = {}
    for name, param in sig.parameters.items():
        if name == "self":
            continue
        annotation = hints.get(name, str)
        default = ... if param.default is inspect.Parameter.empty else param.default
        fields[name] = (annotation, default)

    params_model = pydantic.create_model(f"{func.__name__}_Params", **fields)
    parameters_schema = params_model.model_json_schema()
    parameters_schema.pop("title", None)
    for prop_schema in parameters_schema.get("properties", {}).values():
        prop_schema.pop("title", None)
    # Chat Completions expects a plain object schema with no free-form
    # extra fields, in case the model tries to invent an argument.
    parameters_schema.setdefault("type", "object")
    parameters_schema["additionalProperties"] = False

    description = (inspect.getdoc(func) or func.__name__).strip()
    return {
        "type": "function",
        "function": {
            "name": func.__name__,
            "description": description,
            "parameters": parameters_schema,
        },
    }


@dataclass
class ChatTurnResult:
    final_text: str
    updated_history: List[Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


async def _execute_tool_call(tool_call: Any, tool_callables: Dict[str, Callable]) -> Dict[str, Any]:
    """Dispatch one model-requested tool call to the matching bound
    ChatbotTools method. Never lets a bad/hallucinated call or an internal
    exception escape - always returns a dict the model can react to, and
    never leaks exception internals into that dict (they go to the log only).
    """
    name = tool_call.function.name
    func = tool_callables.get(name)
    if func is None:
        logger.warning("Model attempted to call unknown tool '%s'", name)
        return {"error": f"Unknown tool '{name}'."}

    try:
        kwargs = json.loads(tool_call.function.arguments or "{}")
        if not isinstance(kwargs, dict):
            raise ValueError("arguments did not decode to an object")
    except (json.JSONDecodeError, ValueError):
        logger.warning("Malformed arguments for tool '%s': %r", name, tool_call.function.arguments)
        return {"error": "Malformed arguments were received for this action."}

    try:
        # A real Python TypeError here (missing/unexpected/mistyped kwargs)
        # is the parameter validation - ChatbotTools methods have concrete
        # signatures, so a hallucinated or malformed call fails safely here
        # rather than silently doing the wrong thing.
        return await func(**kwargs)
    except TypeError as e:
        logger.warning("Invalid arguments for tool '%s': %s", name, e)
        return {"error": "Invalid arguments were provided for this action."}
    except Exception:
        logger.exception("Tool '%s' raised an unexpected error", name)
        return {"error": "This action is temporarily unavailable. Please try again."}


async def run_agentic_chat(
    client: AsyncOpenAI,
    model: str,
    system_instruction: str,
    history: List[Any],
    user_message: str,
    tool_callables: Dict[str, Callable],
    tool_schemas: List[Dict[str, Any]],
) -> ChatTurnResult:
    """Run one user turn to completion, including every tool round-trip.

    Chat Completions is stateless, so the full transcript (system prompt +
    prior turns + the new user message) is resent on every call; each tool
    call the model makes is executed locally and its result fed back until
    the model produces a final plain-text answer or MAX_TOOL_ITERATIONS is
    hit.
    """
    messages: List[Any] = (
        [{"role": "system", "content": system_instruction}]
        + list(history)
        + [{"role": "user", "content": user_message}]
    )
    metadata: Dict[str, Any] = {}
    final_text: Optional[str] = None

    for _ in range(MAX_TOOL_ITERATIONS):
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tool_schemas,
            tool_choice="auto",
        )
        choice = response.choices[0]
        message = choice.message
        messages.append(message)

        if not message.tool_calls:
            final_text = message.content
            break

        for tool_call in message.tool_calls:
            result = await _execute_tool_call(tool_call, tool_callables)
            if isinstance(result, dict) and "action" in result:
                metadata["action"] = result["action"]
                metadata["payload"] = result.get("payload", {})
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, default=str),
            })
    else:
        logger.warning("Tool-calling loop exceeded %d iterations without a final answer", MAX_TOOL_ITERATIONS)
        final_text = (
            "I'm having trouble completing that request right now. "
            "Could you try rephrasing it, or breaking it into smaller steps?"
        )

    return ChatTurnResult(
        final_text=final_text or "I'm not sure how to help with that.",
        updated_history=messages[1:],  # drop the system prompt; it's re-added next turn
        metadata=metadata,
    )
