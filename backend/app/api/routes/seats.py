from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models.location import Seat
from app.schemas.core import SeatCreate, SeatUpdate, SeatResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[SeatResponse])
async def get_seats(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Seat).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=SeatResponse)
async def create_seats(
    item_in: SeatCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    item = Seat(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/{id}", response_model=SeatResponse)
async def update_seats(
    id: UUID,
    item_in: SeatUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Seat).where(Seat.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seats(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Seat).where(Seat.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    await db.delete(item)
    await db.commit()
