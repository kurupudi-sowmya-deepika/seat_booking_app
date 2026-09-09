from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models.booking import TimeSlot
from app.schemas.core import TimeSlotCreate, TimeSlotUpdate, TimeSlotResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[TimeSlotResponse])
async def get_time_slots(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TimeSlot).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=TimeSlotResponse)
async def create_time_slots(
    item_in: TimeSlotCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    item = TimeSlot(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/{id}", response_model=TimeSlotResponse)
async def update_time_slots(
    id: UUID,
    item_in: TimeSlotUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(TimeSlot).where(TimeSlot.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="TimeSlot not found")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_slots(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(TimeSlot).where(TimeSlot.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="TimeSlot not found")
        
    await db.delete(item)
    await db.commit()
