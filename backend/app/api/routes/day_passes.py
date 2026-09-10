from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.models.location import DayPass
from app.schemas.core import DayPassCreate, DayPassUpdate, DayPassResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[DayPassResponse])
async def get_day_passes(
    branch_id: Optional[UUID] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    query = select(DayPass)
    if branch_id:
        query = query.where(DayPass.branch_id == branch_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{id}", response_model=DayPassResponse)
async def get_day_pass(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DayPass).where(DayPass.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Day Pass not found")
    return item

@router.post("/", response_model=DayPassResponse)
async def create_day_pass(
    item_in: DayPassCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    item = DayPass(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/{id}", response_model=DayPassResponse)
async def update_day_pass(
    id: UUID,
    item_in: DayPassUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(DayPass).where(DayPass.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Day Pass not found")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_day_pass(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(DayPass).where(DayPass.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Day Pass not found")
        
    await db.delete(item)
    await db.commit()
