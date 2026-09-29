import logging
import uuid
from typing import Awaitable, Callable
import httpx
from fastapi import APIRouter, Depends
from langchain_core.exceptions import (
    ModelAPIError,
    ModelAuthenticationError,
    ModelConnectionError,
    ModelError,
    ModelInvalidRequestError,
    ModelNotFoundError,
    ModelPermissionDeniedError,
    ModelRateLimitError,
    ModelTimeoutError,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.api.deps import get_current_user, get_current_admin
from app.chatbot.schemas import ChatMessage, ChatResponse
from app.chatbot.service import (
    process_chat_message,
    process_admin_chat_message,
    conversations,
    conversation_key,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_FALLBACK_ACTIONS = ["Book a Seat", "Meeting Rooms", "My Bookings"]
_ADMIN_FALLBACK_ACTIONS = ["Show All Bookings", "List Users", "Dashboard Stats"]

# Gemini reports a bad/revoked API key as HTTP 400 "API key not valid" (surfaced as
# ModelInvalidRequestError), so every "the deployment is misconfigured" class is
# grouped here rather than only ModelAuthenticationError.
_MISCONFIGURED_ERRORS = (
    ModelAuthenticationError,
    ModelPermissionDeniedError,
    ModelNotFoundError,
    ModelInvalidRequestError,
)
_UNREACHABLE_ERRORS = (ModelTimeoutError, ModelConnectionError, httpx.TimeoutException, httpx.TransportError)


async def _dispatch(
    process_coro: Callable[[], Awaitable[ChatResponse]],
    conv_id: str,
    current_user: User,
    fallback_actions: list,
) -> ChatResponse:
    """Shared error handling for both the user and admin chat routes - Gemini is
    reached via langchain_google_genai, which classifies provider failures under
    langchain_core's provider-neutral `Model*Error` types regardless of which
    assistant is running."""
    try:
        return await process_coro()
    except ModelRateLimitError as e:
        logger.warning("Gemini rate limit hit for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="The AI assistant is receiving too many requests right now. Please wait a moment and try again.",
            suggested_actions=fallback_actions
        )
    except _MISCONFIGURED_ERRORS as e:
        # Never surface the key or the raw SDK error - just that the deployment is misconfigured.
        logger.error("Gemini rejected the request (check GEMINI_API_KEY / GEMINI_MODEL) for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="The AI assistant is temporarily unavailable. Please try again shortly, or use the booking pages directly.",
            suggested_actions=fallback_actions
        )
    except _UNREACHABLE_ERRORS as e:
        logger.warning("Gemini request timed out/unreachable for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="I'm unable to connect to the AI assistant right now. Please try again in a moment.",
            suggested_actions=fallback_actions
        )
    except (ModelAPIError, ModelError) as e:
        logger.warning("Gemini API error for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="The AI assistant is temporarily unavailable. Please try again shortly, or use the booking pages directly.",
            suggested_actions=fallback_actions
        )
    except Exception:
        # Never leak internal exception details (stack traces, library errors) to the client.
        logger.exception("Unhandled chatbot error for user %s", current_user.id)
        return ChatResponse(
            conversation_id=conv_id,
            message="Sorry, I ran into a problem handling that request. Please try again, or use the booking pages directly.",
            suggested_actions=fallback_actions
        )


@router.post("/message", response_model=ChatResponse)
@router.post("/chat", response_model=ChatResponse)
async def send_message(
    msg_in: ChatMessage,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv_id = msg_in.conversation_id or str(uuid.uuid4())
    return await _dispatch(
        lambda: process_chat_message(message=msg_in.message, conversation_id=conv_id, db=db, current_user=current_user),
        conv_id, current_user, _FALLBACK_ACTIONS,
    )


@router.post("/admin-message", response_model=ChatResponse)
async def send_admin_message(
    msg_in: ChatMessage,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin AI Assistant - gated by `Depends(get_current_admin)`, the actual
    backend authorization boundary: a non-admin gets FastAPI's 403 automatically,
    before AdminChatbotTools is ever constructed."""
    conv_id = msg_in.conversation_id or str(uuid.uuid4())
    return await _dispatch(
        lambda: process_admin_chat_message(message=msg_in.message, conversation_id=conv_id, db=db, current_user=current_admin),
        conv_id, current_admin, _ADMIN_FALLBACK_ACTIONS,
    )


@router.delete("/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    conversations.pop(conversation_key(current_user.id, conversation_id), None)
    return {"status": "success"}


@router.delete("/admin-conversations/{conversation_id}")
async def clear_admin_conversation(conversation_id: str, current_admin: User = Depends(get_current_admin)):
    conversations.pop(conversation_key(current_admin.id, conversation_id), None)
    return {"status": "success"}
