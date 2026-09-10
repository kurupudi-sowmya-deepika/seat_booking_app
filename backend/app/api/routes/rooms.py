from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.models.location import Room, Facility
from app.schemas.core import RoomCreate, RoomUpdate, RoomResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[RoomResponse])
async def get_rooms(
    branch_id: Optional[UUID] = None,
    room_type: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    query = select(Room).options(selectinload(Room.facilities))
    if branch_id:
        query = query.where(Room.branch_id == branch_id)
    if room_type:
        query = query.where(Room.room_type == room_type)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{id}", response_model=RoomResponse)
async def get_room(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Room).options(selectinload(Room.facilities)).where(Room.id == id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Room not found")
    return item

@router.post("/", response_model=RoomResponse)
async def create_rooms(
    item_in: RoomCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    data = item_in.model_dump(exclude={"facility_ids"})
    item = Room(**data)
    
    if item_in.facility_ids:
        fac_res = await db.execute(select(Facility).where(Facility.id.in_(item_in.facility_ids)))
        item.facilities = list(fac_res.scalars().all())
        
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    # Reload with facilities
    refreshed = await db.execute(
        select(Room).options(selectinload(Room.facilities)).where(Room.id == item.id)
    )
    return refreshed.scalar_one()

@router.put("/{id}", response_model=RoomResponse)
async def update_rooms(
    id: UUID,
    item_in: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(
        select(Room).options(selectinload(Room.facilities)).where(Room.id == id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Room not found")
        
    update_data = item_in.model_dump(exclude={"facility_ids"}, exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    if item_in.facility_ids is not None:
        fac_res = await db.execute(select(Facility).where(Facility.id.in_(item_in.facility_ids)))
        item.facilities = list(fac_res.scalars().all())
        
    await db.commit()
    await db.refresh(item)
    
    refreshed = await db.execute(
        select(Room).options(selectinload(Room.facilities)).where(Room.id == item.id)
    )
    return refreshed.scalar_one()

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rooms(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Room).where(Room.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Room not found")
        
    await db.delete(item)
    await db.commit()

