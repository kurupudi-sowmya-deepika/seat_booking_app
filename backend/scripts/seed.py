import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import AsyncSessionLocal, engine
from app.models import User, Location, Branch, Room, Facility, Seat, TimeSlot
from app.models.location import DayPass
from app.models.user import UserRole, AuthProvider, UserStatus
from app.models.wallet import Wallet
from app.core.security import get_password_hash
from datetime import time

load_dotenv()

async def seed_db():
    async with AsyncSessionLocal() as db:
        print("[INFO] Seeding enterprise workspace database...")
        
        # 1. Admin User
        admin_email = "admin@example.com"
        result = await db.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if not admin:
            admin = User(
                email=admin_email,
                password_hash=get_password_hash("admin123"),
                name="System Admin",
                role=UserRole.ADMIN,
                auth_provider=AuthProvider.LOCAL,
                status=UserStatus.ACTIVE
            )
            db.add(admin)
            await db.flush()
            db.add(Wallet(user_id=admin.id, balance=50000.0, currency="INR"))
            print("Created Admin User (admin@example.com / admin123) with 50,000 wallet credits")

        # 2. Basic User
        user_email = "user@example.com"
        result = await db.execute(select(User).where(User.email == user_email))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                email=user_email,
                password_hash=get_password_hash("user123"),
                name="Deepika Kurupudi",
                role=UserRole.USER,
                auth_provider=AuthProvider.LOCAL,
                status=UserStatus.ACTIVE
            )
            db.add(user)
            await db.flush()
            db.add(Wallet(user_id=user.id, balance=50000.0, currency="INR"))
            print("Created Regular User (user@example.com / user123) with 50,000 wallet credits")

        # 3. Facilities
        facility_data = [
            ("High-Speed Wi-Fi", "Gigabit fiber with dedicated SSID", "Equipment"),
            ("Air Conditioning", "Central HVAC climate control", "Facilities"),
            ("Dual 4K Monitors", "USB-C docking station with two 27-inch 4K displays", "Equipment"),
            ("Power Socket", "Universal power sockets with fast USB-C PD", "Equipment"),
            ("Parking", "Reserved underground vehicle and EV charging parking", "Building"),
            ("Artisan Coffee & Tea", "Unlimited espresso, cappuccino, green tea and snacks", "Facilities"),
            ("Heavy-Duty Printer", "High-speed laser printing and color scanning", "Equipment"),
            ("Whiteboard", "Magnetic dry-erase glass board with markers", "Furniture"),
            ("4K Projector", "Ceiling-mounted 4K UHD laser projector", "Equipment"),
            ("Video Conferencing", "Logitech Rally 4K pan-tilt camera with microphone pods", "Equipment"),
            # Non-bookable building/floor objects for the isometric floor-plan editor's
            # facility palette (item_type=FACILITY, purely visual/informational markers -
            # see FloorPlanEditor.tsx's facility library and floor_plan.py's module docstring).
            ("Reception", "Front-desk reception and visitor check-in counter", "Building"),
            ("Stairs", "Fire-rated staircase", "Building"),
            ("Elevator", "Passenger elevator", "Building"),
            ("Restroom", "Restroom facility", "Building"),
            ("Cafeteria", "Staff cafeteria and dining area", "Building"),
            ("Pantry", "Shared pantry with kitchenette", "Building"),
            ("Lounge", "Informal seating and break-out lounge", "Building"),
            ("Storage", "Storage/utility room", "Building"),
            ("Emergency Exit", "Marked emergency exit route", "Building"),
            ("Plant/Decoration", "Decorative plant or greenery", "Building"),
        ]

        facilities_map = {}
        for name, desc, category in facility_data:
            f_res = await db.execute(select(Facility).where(Facility.name == name))
            fac = f_res.scalar_one_or_none()
            if not fac:
                fac = Facility(name=name, description=desc, category=category)
                db.add(fac)
                await db.flush()
            elif not fac.category:
                # Backfill category on a pre-existing row from an older seed run,
                # without touching a category an admin may have since customized.
                fac.category = category
            facilities_map[name] = fac

        await db.commit()
        print(f"[INFO] Loaded {len(facilities_map)} Facilities")

        # 4. Locations (with GPS coordinates for Auto-Detect)
        location_seeds = [
            {
                "name": "Intuceo Inc.",
                "address": "4110 Southpoint Blvd, Suite 124, Jacksonville, FL 32216, USA",
                "city": "Jacksonville",
                "state": "Florida",
                "country": "USA",
                "postal_code": "32216",
                "latitude": 30.3322,
                "longitude": -81.6557
            },
            {
                "name": "Intuceo Inc.",
                "address": "1765 Greensboro Station Place, Suite 900, McLean, VA 22102, USA",
                "city": "McLean",
                "state": "Virginia",
                "country": "USA",
                "postal_code": "22102",
                "latitude": 38.9339,
                "longitude": -77.1773
            },
            {
                "name": "Intuceo UK",
                "address": "London, United Kingdom",
                "city": "London",
                "state": "Greater London",
                "country": "UK",
                "postal_code": "EC1A 1BB",
                "latitude": 51.5074,
                "longitude": -0.1278
            },
            {
                "name": "Intuceo",
                "address": "Bangalore, Karnataka, India",
                "city": "Bangalore",
                "state": "Karnataka",
                "country": "India",
                "postal_code": "560004",
                "latitude": 12.9716,
                "longitude": 77.5946
            },
            {
                "name": "Intuceo",
                "address": "Hyderabad, Telangana, India",
                "city": "Hyderabad",
                "state": "Telangana",
                "country": "India",
                "postal_code": "500081",
                "latitude": 17.385,
                "longitude": 78.4867
            }
        ]

        locations = {}
        for loc_data in location_seeds:
            l_res = await db.execute(select(Location).where(Location.city == loc_data["city"]))
            loc = l_res.scalar_one_or_none()
            if not loc:
                loc = Location(**loc_data)
                db.add(loc)
                await db.flush()
            else:
                loc.name = loc_data["name"]
                loc.address = loc_data["address"]
                loc.state = loc_data["state"]
                loc.country = loc_data["country"]
                loc.postal_code = loc_data["postal_code"]
                loc.latitude = loc_data["latitude"]
                loc.longitude = loc_data["longitude"]
            locations[loc.city] = loc

        await db.commit()
        print(f"Loaded {len(locations)} Locations with GPS coordinates")

        # 5. Branches
        branches_data = [
            (locations["Jacksonville"].id, "Headquarters", "4110 Southpoint Blvd, Suite 124, Jacksonville, FL 32216, USA", "Global Headquarters"),
            (locations["McLean"].id, "Washington D.C. Area Office", "1765 Greensboro Station Place, Suite 900, McLean, VA 22102, USA", "Washington D.C. Area Office"),
            (locations["London"].id, "Europe Office", "London, United Kingdom", "Europe Regional Office"),
            (locations["Bangalore"].id, "Development Center", "Bangalore, Karnataka, India", "India Development Center"),
            (locations["Hyderabad"].id, "Development Center", "Hyderabad, Telangana, India", "India Development Center")
        ]

        branches = []
        for loc_id, b_name, b_addr, b_desc in branches_data:
            b_res = await db.execute(select(Branch).where(Branch.name == b_name))
            br = b_res.scalar_one_or_none()
            if not br:
                br = Branch(location_id=loc_id, name=b_name, address=b_addr, description=b_desc)
                db.add(br)
                await db.flush()
            branches.append(br)

        await db.commit()
        print(f"[INFO] Loaded {len(branches)} Branches")

        DEFAULT_DAY_PASS_AMENITIES = [
            "Wi-Fi", "Parking", "Cafeteria", "Power Outlet", "Lounge Access", "Printing", "Coffee/Tea"
        ]
        meeting_room_names = ["Luna", "Nova", "Mars", "Titan", "Apollo"]
        conference_room_names = ["Orion", "Voyager", "Galaxy", "Horizon", "Comet"]

        # 6. Rooms, Day Passes, Seats per Branch
        for br_idx, br in enumerate(branches):
            # Day Pass
            dp_res = await db.execute(select(DayPass).where(DayPass.branch_id == br.id))
            dp = dp_res.scalar_one_or_none()
            if not dp:
                dp = DayPass(
                    branch_id=br.id,
                    name=f"{br.name} Hot Desk Day Pass",
                    description="Full day access to hot desks, high-speed Wi-Fi, coffee bar, and common facilities.",
                    price=450.00 if "Koramangala" in br.name or "Hitech" in br.name else 400.00,
                    daily_capacity=25,
                    amenities=DEFAULT_DAY_PASS_AMENITIES,
                    status="ACTIVE"
                )
                db.add(dp)
            elif not dp.amenities:
                dp.amenities = DEFAULT_DAY_PASS_AMENITIES

            # Workspace Room A (Quiet Zone)
            rm_a_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.name == "Room A - Focus Zone"))
            rm_a = rm_a_res.scalar_one_or_none()
            if not rm_a:
                rm_a = Room(
                    branch_id=br.id,
                    name="Room A - Focus Zone",
                    description="Quiet dedicated workspace with ergonomic Herman Miller desks",
                    room_type="WORKSPACE",
                    capacity=12,
                    status="ACTIVE"
                )
                rm_a.facilities = [facilities_map["High-Speed Wi-Fi"], facilities_map["Air Conditioning"], facilities_map["Power Socket"], facilities_map["Artisan Coffee & Tea"]]
                db.add(rm_a)
                await db.flush()

                # Seats for Room A
                for i in range(1, 13):
                    seat_num = f"A{i:02d}"
                    is_prem = i in [1, 2, 5, 6]
                    seat = Seat(
                        room_id=rm_a.id,
                        seat_number=seat_num,
                        seat_type="PREMIUM" if is_prem else "STANDARD",
                        description="Ultra-wide monitor & window view" if is_prem else "Standard ergonomic desk",
                        price=150.00 if is_prem else 90.00,
                        status="ACTIVE"
                    )
                    db.add(seat)

            # Workspace Room B (Collaboration Zone)
            rm_b_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.name == "Room B - Collaboration"))
            rm_b = rm_b_res.scalar_one_or_none()
            if not rm_b:
                rm_b = Room(
                    branch_id=br.id,
                    name="Room B - Collaboration",
                    description="Open desk layout optimized for team brainstorms and agile sprints",
                    room_type="WORKSPACE",
                    capacity=10,
                    status="ACTIVE"
                )
                rm_b.facilities = [facilities_map["High-Speed Wi-Fi"], facilities_map["Air Conditioning"], facilities_map["Whiteboard"], facilities_map["Artisan Coffee & Tea"]]
                db.add(rm_b)
                await db.flush()

                for i in range(1, 11):
                    seat_num = f"B{i:02d}"
                    seat = Seat(
                        room_id=rm_b.id,
                        seat_number=seat_num,
                        seat_type="STANDARD",
                        description="Collaboration desk with whiteboards nearby",
                        price=80.00,
                        status="ACTIVE"
                    )
                    db.add(seat)

            # Meeting Rooms (planet-themed, configurable names)
            meeting_facilities = [
                facilities_map["High-Speed Wi-Fi"], facilities_map["Air Conditioning"],
                facilities_map["Video Conferencing"], facilities_map["Whiteboard"],
                facilities_map["Artisan Coffee & Tea"]
            ]
            for i, name in enumerate(meeting_room_names[:3]):
                mr_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.name == name))
                if not mr_res.scalar_one_or_none():
                    mr = Room(
                        branch_id=br.id,
                        name=name,
                        description=f"{name} meeting room — video conferencing and whiteboard ready",
                        room_type="MEETING_ROOM",
                        capacity=6 + i * 2,
                        floor=2 + (i % 3),
                        price_per_hour=400.00 + i * 50,
                        status="ACTIVE"
                    )
                    mr.facilities = meeting_facilities
                    db.add(mr)

            legacy_mr = (await db.execute(select(Room).where(Room.branch_id == br.id, Room.name == "Executive Meeting Suite"))).scalar_one_or_none()
            if legacy_mr:
                legacy_mr.name = "Luna"
                legacy_mr.floor = 2

            conference_facilities = [
                facilities_map["High-Speed Wi-Fi"], facilities_map["Air Conditioning"],
                facilities_map["4K Projector"], facilities_map["Video Conferencing"],
                facilities_map["Whiteboard"], facilities_map["Artisan Coffee & Tea"],
                facilities_map["Dual 4K Monitors"]
            ]
            for i, name in enumerate(conference_room_names[:2]):
                cr_res = await db.execute(select(Room).where(Room.branch_id == br.id, Room.name == name))
                if not cr_res.scalar_one_or_none():
                    cr = Room(
                        branch_id=br.id,
                        name=name,
                        description=f"{name} conference room — presentation and telepresence ready",
                        room_type="CONFERENCE_ROOM",
                        capacity=12 + i * 6,
                        floor=3,
                        price_per_hour=900.00 + i * 300,
                        status="ACTIVE"
                    )
                    cr.facilities = conference_facilities
                    db.add(cr)

            legacy_cr = (await db.execute(select(Room).where(Room.branch_id == br.id, Room.name == "Grand Boardroom"))).scalar_one_or_none()
            if legacy_cr:
                legacy_cr.name = "Orion"
                legacy_cr.floor = 3

        # 7. Time Slots
        time_slot_definitions = [
            (9, 10), (10, 11), (11, 12), (12, 13), 
            (14, 15), (15, 16), (16, 17), (17, 18)
        ]
        for start_h, end_h in time_slot_definitions:
            ts_res = await db.execute(
                select(TimeSlot).where(TimeSlot.start_time == time(start_h, 0), TimeSlot.end_time == time(end_h, 0))
            )
            if not ts_res.scalar_one_or_none():
                ts = TimeSlot(
                    start_time=time(start_h, 0),
                    end_time=time(end_h, 0),
                    status="ACTIVE"
                )
                db.add(ts)

        await db.commit()
        print("[SUCCESS] Database successfully seeded with enterprise locations, branches, rooms, seats, day passes, meeting & conference rooms!")

if __name__ == "__main__":
    asyncio.run(seed_db())
