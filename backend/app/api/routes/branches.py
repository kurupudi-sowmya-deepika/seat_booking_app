from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models.location import Branch
from app.schemas.core import BranchCreate, BranchUpdate, BranchResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[BranchResponse])
async def get_branches(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Branch).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=BranchResponse)
async def create_branches(
    item_in: BranchCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    item = Branch(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/{id}", response_model=BranchResponse)
async def update_branches(
    id: UUID,
    item_in: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Branch).where(Branch.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Branch not found")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branches(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Branch).where(Branch.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Branch not found")
        
    await db.delete(item)
    await db.commit()
