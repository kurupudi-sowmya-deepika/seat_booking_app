import math
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.models.location import Location, Branch
from app.schemas.core import LocationCreate, LocationUpdate, LocationResponse, BranchResponse
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User

router = APIRouter()

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Earth radius in kilometers
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@router.get("/nearest")
async def get_nearest_location(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    db: AsyncSession = Depends(get_db)
):
    target_lat = latitude if latitude is not None else lat
    target_lon = longitude if longitude is not None else lon
    if target_lat is None or target_lon is None:
        raise HTTPException(status_code=400, detail="latitude and longitude (or lat and lon) are required")

    result = await db.execute(select(Location).where(Location.status == "ACTIVE"))
    locations = result.scalars().all()
    
    if not locations:
        raise HTTPException(status_code=404, detail="No active locations found")
        
    nearest_loc = None
    min_dist = float("inf")
    
    for loc in locations:
        if loc.latitude is not None and loc.longitude is not None:
            dist = haversine_distance(target_lat, target_lon, loc.latitude, loc.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest_loc = loc
                
    if not nearest_loc:
        # Fallback to the first location if none have GPS coords
        nearest_loc = locations[0]
        min_dist = 0.0

    # Find suggested branch
    b_result = await db.execute(select(Branch).where(Branch.location_id == nearest_loc.id, Branch.status == "ACTIVE"))
    branches = b_result.scalars().all()
    suggested_branch = branches[0] if branches else None
    
    return {
        "location": LocationResponse.model_validate(nearest_loc),
        "distance_km": round(min_dist, 2),
        "suggested_branch": BranchResponse.model_validate(suggested_branch) if suggested_branch else None
    }

@router.get("/", response_model=List[LocationResponse])
async def get_locations(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Location).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/", response_model=LocationResponse)
async def create_locations(
    item_in: LocationCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    item = Location(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/{id}", response_model=LocationResponse)
async def update_locations(
    id: UUID,
    item_in: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Location).where(Location.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Location not found")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_locations(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    result = await db.execute(select(Location).where(Location.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Location not found")
        
    await db.delete(item)
    await db.commit()
