import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.chatbot.schemas import ChatMessage, ChatResponse
from app.chatbot.service import process_chat_message, conversations

router = APIRouter()

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    if conversation_id in conversations:
        del conversations[conversation_id]
    return {"status": "success"}
