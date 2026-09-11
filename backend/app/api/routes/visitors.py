from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.models.visitor import Visitor, VisitorStatus
from app.models.location import Branch
from app.models.user import User
from app.schemas.visitor import VisitorCreate, VisitorUpdate, VisitorResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.notification import Notification, NotificationType

router = APIRouter()

def map_visitor(v: Visitor) -> VisitorResponse:
    return VisitorResponse(
        id=v.id,
        host_user_id=v.host_user_id,
        host_name=v.host.name if v.host else None,
        branch_id=v.branch_id,
        branch_name=v.branch.name if v.branch else None,
        visitor_name=v.visitor_name,
        visitor_email=v.visitor_email,
        visitor_phone=v.visitor_phone,
        purpose=v.purpose,
        visit_date=v.visit_date,
        expected_arrival_time=v.expected_arrival_time,
        check_in_time=v.check_in_time,
        check_out_time=v.check_out_time,
        notes=v.notes,
        status=v.status,
        created_at=v.created_at
    )

@router.get("/", response_model=List[VisitorResponse])
async def get_visitors(
    branch_id: Optional[UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Visitor).options(
        selectinload(Visitor.host),
        selectinload(Visitor.branch)
    )

    if current_user.role != "ADMIN":
        query = query.where(Visitor.host_user_id == current_user.id)
    else:
        if branch_id:
            query = query.where(Visitor.branch_id == branch_id)

    if status:
        query = query.where(Visitor.status == status)

    query = query.order_by(Visitor.visit_date.desc(), Visitor.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    visitors = result.scalars().all()
    return [map_visitor(v) for v in visitors]

@router.post("/", response_model=VisitorResponse)
async def create_visitor(
    item_in: VisitorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    visitor = Visitor(
        host_user_id=current_user.id,
        branch_id=item_in.branch_id,
        visitor_name=item_in.visitor_name,
        visitor_email=item_in.visitor_email,
        visitor_phone=item_in.visitor_phone,
        purpose=item_in.purpose or "Meeting / Collaboration",
        visit_date=item_in.visit_date,
        expected_arrival_time=item_in.expected_arrival_time,
        notes=item_in.notes,
        status=VisitorStatus.PENDING
    )
    db.add(visitor)
    await db.flush()

    # Create host notification
    notif = Notification(
        user_id=current_user.id,
        title="Visitor Registered",
        message=f"Visitor pass created for {visitor.visitor_name} on {visitor.visit_date}.",
        type=NotificationType.SYSTEM,
        reference_id=str(visitor.id)
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(visitor)
    
    # Reload relationships
    res = await db.execute(
        select(Visitor).options(selectinload(Visitor.host), selectinload(Visitor.branch)).where(Visitor.id == visitor.id)
    )
    return map_visitor(res.scalar_one())

@router.put("/{visitor_id}", response_model=VisitorResponse)
async def update_visitor(
    visitor_id: UUID,
    item_in: VisitorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Visitor).options(selectinload(Visitor.host), selectinload(Visitor.branch)).where(Visitor.id == visitor_id)
    if current_user.role != "ADMIN":
        query = query.where(Visitor.host_user_id == current_user.id)

    res = await db.execute(query)
    visitor = res.scalar_one_or_none()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor pass not found")

    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(visitor, field, value)

    await db.commit()
    await db.refresh(visitor)
    return map_visitor(visitor)

@router.post("/{visitor_id}/check-in", response_model=VisitorResponse)
async def check_in_visitor(
    visitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Visitor).options(selectinload(Visitor.host), selectinload(Visitor.branch)).where(Visitor.id == visitor_id)
    if current_user.role != "ADMIN":
        query = query.where(Visitor.host_user_id == current_user.id)

    res = await db.execute(query)
    visitor = res.scalar_one_or_none()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    visitor.status = VisitorStatus.CHECKED_IN
    visitor.check_in_time = datetime.utcnow()
    
    # Send host notification
    notif = Notification(
        user_id=visitor.host_user_id,
        title="Visitor Arrived!",
        message=f"Your guest {visitor.visitor_name} has checked in at {visitor.branch.name if visitor.branch else 'Front Desk'}.",
        type=NotificationType.VISITOR_ARRIVED,
        reference_id=str(visitor.id)
    )
    db.add(notif)

    await db.commit()
    await db.refresh(visitor)
    return map_visitor(visitor)

@router.post("/{visitor_id}/check-out", response_model=VisitorResponse)
async def check_out_visitor(
    visitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Visitor).options(selectinload(Visitor.host), selectinload(Visitor.branch)).where(Visitor.id == visitor_id)
    if current_user.role != "ADMIN":
        query = query.where(Visitor.host_user_id == current_user.id)

    res = await db.execute(query)
    visitor = res.scalar_one_or_none()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    visitor.status = VisitorStatus.CHECKED_OUT
    visitor.check_out_time = datetime.utcnow()
    await db.commit()
    await db.refresh(visitor)
    return map_visitor(visitor)

@router.delete("/{visitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visitor(
    visitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Visitor).where(Visitor.id == visitor_id)
    if current_user.role != "ADMIN":
        query = query.where(Visitor.host_user_id == current_user.id)
        
    res = await db.execute(query)
    visitor = res.scalar_one_or_none()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor pass not found")
        
    await db.delete(visitor)
    await db.commit()
