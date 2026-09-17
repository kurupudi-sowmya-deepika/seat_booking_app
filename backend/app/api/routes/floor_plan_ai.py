"""AI-assisted room generation endpoint for Floor Plan Management.

Kept as a sibling of `floor_plans.py` (same `/floor-plans` URL prefix, separate
module) rather than folded into it, so the LLM/catalog-specific glue doesn't
dilute that file's documented draft/publish-invariant focus. See
`app/services/floor_plan_ai.py` for the actual generation logic - this route
is a thin admin-gated wrapper around it and persists nothing itself.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.api.routes.floor_plans import _get_floor_or_404
from app.chatbot.langchain_service import OpenRouterConfigError
from app.db.database import get_db
from app.models.user import User
from app.schemas.floor_plan_ai import GenerateRoomsRequest, GenerateRoomsResponse
from app.services.floor_plan_ai import generate_rooms_for_floor

router = APIRouter()


@router.post("/floors/{floor_id}/generate-rooms", response_model=GenerateRoomsResponse)
async def generate_rooms(
    floor_id: UUID,
    payload: GenerateRoomsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Proposes a set of rooms for the floor - or regenerates exactly one, when
    `regenerate_room_name`/`pending_rooms` are set. Nothing is persisted here;
    the admin accepts the proposal via the existing `/floors/{id}/save`."""
    floor = await _get_floor_or_404(db, floor_id)
    if payload.regenerate_room_name and not payload.pending_rooms:
        raise HTTPException(status_code=400, detail="pending_rooms is required when regenerating a single room.")
    try:
        return await generate_rooms_for_floor(db, floor, payload, current_user)
    except OpenRouterConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
