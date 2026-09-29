import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.location import Location, Branch, Room, Seat, DayPass, Facility

async def sync_locations():
    async with AsyncSessionLocal() as db:
        fac_res = await db.execute(select(Facility))
        facs = fac_res.scalars().all()
        fac_map = {f.name: f for f in facs}

        locations_to_sync = [
            {
                "city": "Jacksonville",
                "name": "Intuceo Inc.",
                "address": "4110 Southpoint Blvd, Suite 124, Jacksonville, FL 32216, USA",
                "state": "Florida",
                "country": "USA",
                "postal_code": "32216",
                "latitude": 30.3322,
                "longitude": -81.6557,
                "branch_name": "Headquarters",
                "branch_desc": "Global Corporate Headquarters"
            },
            {
                "city": "McLean",
                "name": "Intuceo Inc.",
                "address": "1765 Greensboro Station Place, Suite 900, McLean, VA 22102, USA",
                "state": "Virginia",
                "country": "USA",
                "postal_code": "22102",
                "latitude": 38.9339,
                "longitude": -77.1773,
                "branch_name": "Washington D.C. Area Office",
                "branch_desc": "Washington D.C. Area Office"
            },
            {
                "city": "London",
                "name": "Intuceo UK",
                "address": "London, United Kingdom",
                "state": "Greater London",
                "country": "UK",
                "postal_code": "EC1A 1BB",
                "latitude": 51.5074,
                "longitude": -0.1278,
                "branch_name": "Europe Office",
                "branch_desc": "Europe Office"
            },
            {
                "city": "Bangalore",
                "name": "Intuceo",
                "address": "Bangalore, Karnataka, India",
                "state": "Karnataka",
                "country": "India",
                "postal_code": "560004",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "branch_name": "Development Center",
                "branch_desc": "Development Center"
            },
            {
                "city": "Hyderabad",
                "name": "Intuceo",
                "address": "Hyderabad, Telangana, India",
                "state": "Telangana",
                "country": "India",
                "postal_code": "500081",
                "latitude": 17.385,
                "longitude": 78.4867,
                "branch_name": "Development Center",
                "branch_desc": "Development Center"
            }
        ]

        DEFAULT_DAY_PASS_AMENITIES = ["Wi-Fi", "Parking", "Cafeteria", "Power Outlet", "Lounge Access", "Printing", "Coffee/Tea"]

        for loc_info in locations_to_sync:
            l_res = await db.execute(select(Location).where(Location.city == loc_info["city"]))
            loc = l_res.scalar_one_or_none()
            if not loc:
                loc = Location(
                    name=loc_info["name"],
                    city=loc_info["city"],
                    address=loc_info["address"],
                    state=loc_info["state"],
                    country=loc_info["country"],
                    postal_code=loc_info["postal_code"],
                    latitude=loc_info["latitude"],
                    longitude=loc_info["longitude"],
                    status="ACTIVE"
                )
                db.add(loc)
                await db.flush()
                print(f"[OK] Added location: {loc.name} ({loc.city})")
            else:
                loc.name = loc_info["name"]
                loc.address = loc_info["address"]
                loc.state = loc_info["state"]
                loc.country = loc_info["country"]
                loc.postal_code = loc_info["postal_code"]
                loc.latitude = loc_info["latitude"]
                loc.longitude = loc_info["longitude"]
                loc.status = "ACTIVE"
                print(f"[OK] Updated location: {loc.name} ({loc.city})")

            # Check branch
            b_res = await db.execute(select(Branch).where(Branch.location_id == loc.id))
            branches = b_res.scalars().all()
            if not branches:
                branch = Branch(
                    location_id=loc.id,
                    name=loc_info["branch_name"],
                    address=loc_info["address"],
                    description=loc_info["branch_desc"],
                    status="ACTIVE"
                )
                db.add(branch)
                await db.flush()
                branches = [branch]
                print(f"   -> Added branch: {branch.name}")

            for br in branches:
                # Ensure Day Pass
                dp_res = await db.execute(select(DayPass).where(DayPass.branch_id == br.id))
                dp = dp_res.scalars().first()
                if not dp:
                    dp = DayPass(
                        branch_id=br.id,
                        name=f"{br.name} Hot Desk Day Pass",
                        description="Full day workspace access, high-speed Wi-Fi, coffee bar, and lounge access.",
                        price=500.0,
                        daily_capacity=30,
                        amenities=DEFAULT_DAY_PASS_AMENITIES,
                        status="ACTIVE"
                    )
                    db.add(dp)

                # Ensure Workspace Room
                rm_a_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.room_type == "WORKSPACE"))
                rm_a = rm_a_res.scalars().first()
                if not rm_a:
                    rm_a = Room(
                        branch_id=br.id,
                        name="Focus Workspace A",
                        description="Ergonomic workstations with dual monitors and quiet zone atmosphere",
                        room_type="WORKSPACE",
                        capacity=12,
                        status="ACTIVE"
                    )
                    if "High-Speed Wi-Fi" in fac_map and "Air Conditioning" in fac_map:
                        rm_a.facilities = [fac_map["High-Speed Wi-Fi"], fac_map["Air Conditioning"]]
                    db.add(rm_a)
                    await db.flush()

                    for i in range(1, 13):
                        seat = Seat(
                            room_id=rm_a.id,
                            seat_number=f"A{i:02d}",
                            seat_type="PREMIUM" if i in [1, 2, 5, 6] else "STANDARD",
                            description="Premium desk with monitor" if i in [1, 2, 5, 6] else "Ergonomic desk",
                            price=150.0 if i in [1, 2, 5, 6] else 90.0,
                            status="ACTIVE"
                        )
                        db.add(seat)

                # Ensure Meeting Room
                mr_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.room_type == "MEETING_ROOM"))
                if not mr_res.scalars().first():
                    mr = Room(
                        branch_id=br.id,
                        name="Apollo Meeting Room",
                        description="Equipped with 4K display, video conferencing, and digital whiteboard",
                        room_type="MEETING_ROOM",
                        capacity=8,
                        floor=2,
                        price_per_hour=400.0,
                        status="ACTIVE"
                    )
                    db.add(mr)

                # Ensure Conference Room
                cr_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.room_type == "CONFERENCE_ROOM"))
                if not cr_res.scalars().first():
                    cr = Room(
                        branch_id=br.id,
                        name="Orion Conference Hall",
                        description="Large executive boardroom with multi-screen projection and audio systems",
                        room_type="CONFERENCE_ROOM",
                        capacity=16,
                        floor=3,
                        price_per_hour=900.0,
                        status="ACTIVE"
                    )
                    db.add(cr)

        await db.commit()
        print("[SUCCESS] Database successfully synced with all 5 required locations!")

if __name__ == "__main__":
    asyncio.run(sync_locations())
