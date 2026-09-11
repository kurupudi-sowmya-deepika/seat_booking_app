import logging
import uuid
import openai
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.chatbot.schemas import ChatMessage, ChatResponse
from app.chatbot.service import process_chat_message, conversations, conversation_key

logger = logging.getLogger(__name__)
router = APIRouter()

_FALLBACK_ACTIONS = ["Book a Seat", "Meeting Rooms", "My Bookings"]

@router.post("/message", response_model=ChatResponse)
@router.post("/chat", response_model=ChatResponse)
async def send_message(
    msg_in: ChatMessage,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv_id = msg_in.conversation_id or str(uuid.uuid4())

    try:
        response = await process_chat_message(
            message=msg_in.message,
            conversation_id=conv_id,
            db=db,
            current_user=current_user
        )
        return response
    except openai.RateLimitError as e:
        logger.warning("OpenAI rate limit hit for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="The AI assistant is receiving too many requests right now. Please wait a moment and try again.",
            suggested_actions=_FALLBACK_ACTIONS
        )
    except openai.AuthenticationError as e:
        # Never surface the key or the raw SDK error - just that the deployment is misconfigured.
        logger.error("OpenAI authentication failed (check OPENAI_API_KEY) for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="The AI assistant is temporarily unavailable. Please try again shortly, or use the booking pages directly.",
            suggested_actions=_FALLBACK_ACTIONS
        )
    except (openai.APITimeoutError, openai.APIConnectionError) as e:
        logger.warning("OpenAI request timed out/unreachable for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="I'm unable to connect to the AI assistant right now. Please try again in a moment.",
            suggested_actions=_FALLBACK_ACTIONS
        )
    except openai.APIError as e:
        logger.warning("OpenAI API error for user %s: %s", current_user.id, e)
        return ChatResponse(
            conversation_id=conv_id,
            message="The AI assistant is temporarily unavailable. Please try again shortly, or use the booking pages directly.",
            suggested_actions=_FALLBACK_ACTIONS
        )
    except Exception:
        # Never leak internal exception details (stack traces, library errors) to the client.
        logger.exception("Unhandled chatbot error for user %s", current_user.id)
        return ChatResponse(
            conversation_id=conv_id,
            message="Sorry, I ran into a problem handling that request. Please try again, or use the booking pages directly.",
            suggested_actions=_FALLBACK_ACTIONS
        )

@router.delete("/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    conversations.pop(conversation_key(current_user.id, conversation_id), None)
    return {"status": "success"}
