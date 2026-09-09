from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatMessage(BaseModel):
    conversation_id: Optional[str] = None
    message: str

class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    suggested_actions: List[str] = []
    metadata: Dict[str, Any] = {}
