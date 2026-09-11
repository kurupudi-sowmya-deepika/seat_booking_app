"""LangChain/LangGraph-backed chat runner.

This module owns everything specific to running the chatbot conversation
through LangChain's `create_agent` (a LangGraph agent under the hood):
building the `ChatOpenAI` model, wrapping `ChatbotTools` methods as safe
tools, and running one turn of the tool-calling agent loop.
`app/chatbot/service.py` is the provider-agnostic orchestrator (conversation
history, system prompt, response shaping) and should not import `langchain*`
or `openai` directly - that keeps a future swap contained to this file.
"""
import functools
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Sequence

from langchain.agents import create_agent
from langchain_core.messages import BaseMessage, HumanMessage, ToolMessage
from langgraph.errors import GraphRecursionError
from langchain_openai import ChatOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# A single chat turn can legitimately need several tool round-trips (e.g.
# check availability, then resolve_booking_conflict, then confirm_intent_to_book).
# Passed as LangGraph's own recursion_limit, which otherwise defaults to 25
# graph steps (~12 tool calls) and raises GraphRecursionError past that.
RECURSION_LIMIT = 25

# The OpenAI SDK underneath ChatOpenAI retries transient errors itself; both
# are set explicitly so a hung request surfaces as a clear, handleable
# timeout instead of blocking the chat request indefinitely.
REQUEST_TIMEOUT_SECONDS = 30.0
MAX_SDK_RETRIES = 2


class OpenRouterConfigError(RuntimeError):
    """Raised when OPENROUTER_API_KEY is missing or blank at request time."""


def get_model() -> ChatOpenAI:
    """Build the chat model from server-side settings only.

    OpenRouter is reached through `langchain_openai.ChatOpenAI` since it's an
    OpenAI-API-compatible gateway (same request/response shapes, including
    tool/function calling) - just pointed at OPENROUTER_BASE_URL with an
    OpenRouter key and model id instead of api.openai.com.

    Raises OpenRouterConfigError with a clear, actionable message if the key
    isn't configured - callers turn this into a friendly in-chat message
    rather than a raw 500, but it's still logged loudly server-side so a
    misconfigured deployment is obvious from the logs.
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise OpenRouterConfigError(
            "OPENROUTER_API_KEY is not configured. Set OPENROUTER_API_KEY in the root "
            ".env file and restart the backend to enable the AI assistant."
        )
    return ChatOpenAI(
        model=settings.OPENROUTER_MODEL,
        api_key=api_key,
        base_url=settings.OPENROUTER_BASE_URL,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=MAX_SDK_RETRIES,
    )


def make_safe_tool(func: Callable) -> Callable:
    """Wrap a bound ChatbotTools method so a bug or DB error inside it can
    never crash the whole turn.

    LangGraph's built-in tool-error handling only catches parameter
    validation errors (bad/missing args from the model) and re-raises
    everything else - this is the backstop for real runtime exceptions
    (DB errors, bugs), matching "never leak exception internals, never
    silently crash a turn". `functools.wraps` preserves the original
    signature/docstring so LangChain's automatic schema generation still
    sees the real parameters, not `*args, **kwargs`.
    """
    @functools.wraps(func)
    async def safe_tool(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception:
            logger.exception("Tool '%s' raised an unexpected error", func.__name__)
            return {"error": "This action is temporarily unavailable. Please try again."}

    return safe_tool


@dataclass
class ChatTurnResult:
    final_text: str
    updated_history: List[BaseMessage]
    metadata: Dict[str, Any] = field(default_factory=dict)


def _extract_metadata(messages: Sequence[BaseMessage]) -> Dict[str, Any]:
    """Scan this turn's tool results for the confirmation-card sentinel shape
    `{"action": ..., "payload": ...}` that mutating tools return instead of
    acting directly (see ChatbotTools.confirm_intent_to_book etc.)."""
    metadata: Dict[str, Any] = {}
    for message in messages:
        if not isinstance(message, ToolMessage):
            continue
        try:
            content = message.content
            result = json.loads(content) if isinstance(content, str) else content
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(result, dict) and "action" in result:
            metadata["action"] = result["action"]
            metadata["payload"] = result.get("payload", {})
    return metadata


async def run_agentic_chat(
    model: ChatOpenAI,
    system_instruction: str,
    history: List[BaseMessage],
    user_message: str,
    tool_callables: List[Callable],
) -> ChatTurnResult:
    """Run one user turn to completion via a LangChain/LangGraph agent,
    including every tool round-trip.

    No checkpointer is used - conversation memory is the same in-memory,
    per-conversation message list `service.py` already keeps (consistent
    with the rest of this app's "not persisted, resets on restart" chatbot
    state), just built from LangChain BaseMessage objects instead of raw
    OpenAI SDK message dicts. The full transcript is passed in and the full
    updated transcript comes back in `result["messages"]`.
    """
    agent = create_agent(
        model=model,
        tools=tool_callables,
        system_prompt=system_instruction,
    )

    try:
        result = await agent.ainvoke(
            {"messages": [*history, HumanMessage(content=user_message)]},
            config={"recursion_limit": RECURSION_LIMIT},
        )
    except GraphRecursionError:
        logger.warning("Agent exceeded recursion_limit=%d without a final answer", RECURSION_LIMIT)
        return ChatTurnResult(
            final_text=(
                "I'm having trouble completing that request right now. "
                "Could you try rephrasing it, or breaking it into smaller steps?"
            ),
            updated_history=history,
        )

    messages: List[BaseMessage] = result["messages"]
    new_messages = messages[len(history):]
    final_text = messages[-1].content if messages else ""

    return ChatTurnResult(
        final_text=final_text or "I'm not sure how to help with that.",
        updated_history=messages,
        metadata=_extract_metadata(new_messages),
    )
