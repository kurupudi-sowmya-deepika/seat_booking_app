import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import AsyncSessionLocal, engine
from app.models import User, Location, Branch, Room, Facility, Seat, TimeSlot
from app.models.user import UserRole, AuthProvider
from app.models.wallet import Wallet
from app.core.security import get_password_hash
from datetime import time

load_dotenv()

async def seed_db():
    async with AsyncSessionLocal() as db:
        print("Seeding database...")
        
        # 1. Admin User
        admin_email = "admin@example.com"
        result = await db.execute(User.__table__.select().where(User.email == admin_email))
        admin_exists = result.first()
        
        if not admin_exists:
            admin = User(
                email=admin_email,
                password_hash=get_password_hash("admin123"),
                name="System Admin",
                role=UserRole.ADMIN,
                auth_provider=AuthProvider.LOCAL
            )
            db.add(admin)
            await db.flush()
            db.add(Wallet(user_id=admin.id, balance=10000.0))
            print("Created Admin User")

        # 2. Basic User
        user_email = "user@example.com"
        result = await db.execute(User.__table__.select().where(User.email == user_email))
        user_exists = result.first()
        
        if not user_exists:
            user = User(
                email=user_email,
                password_hash=get_password_hash("user123"),
                name="Regular User",
                role=UserRole.USER,
                auth_provider=AuthProvider.LOCAL
            )
            db.add(user)
            await db.flush()
            db.add(Wallet(user_id=user.id, balance=500.0))
            print("Created Regular User")

        # 3. Facilities
        facility_names = ["Wi-Fi", "AC", "Monitor", "Parking", "Power Socket", "Coffee"]
        facilities = []
        for name in facility_names:
            fac = Facility(name=name, description=f"{name} facility")
            db.add(fac)
            facilities.append(fac)
            
        await db.commit()
        print("Created Facilities")

        # 4. Locations
        loc_blr = Location(name="Bangalore HQ", address="123 Tech Park", city="Bangalore", state="Karnataka", country="India", postal_code="560001")
        loc_hyd = Location(name="Hyderabad Hub", address="456 Cyber City", city="Hyderabad", state="Telangana", country="India", postal_code="500081")
        db.add_all([loc_blr, loc_hyd])
        await db.commit()
        await db.refresh(loc_blr)
        await db.refresh(loc_hyd)

        # 5. Branches
        br_wf = Branch(location_id=loc_blr.id, name="Whitefield", address="Whitefield Main Rd", description="Main campus")
        br_km = Branch(location_id=loc_blr.id, name="Koramangala", address="100ft Road", description="Startup hub")
        br_hc = Branch(location_id=loc_hyd.id, name="Hitech City", address="Mindspace", description="Tech hub")
        db.add_all([br_wf, br_km, br_hc])
        await db.commit()
        await db.refresh(br_wf)

        # 6. Rooms
        rm_a = Room(branch_id=br_wf.id, name="Room A", description="Quiet Zone", capacity=10)
        rm_b = Room(branch_id=br_wf.id, name="Room B", description="Collaborative Zone", capacity=15)
        rm_meet = Room(branch_id=br_wf.id, name="Meeting Room", description="For meetings", capacity=5)
        db.add_all([rm_a, rm_b, rm_meet])
        await db.commit()
        await db.refresh(rm_a)

        # Add facilities to Room A
        rm_a.facilities.extend(facilities)
        await db.commit()

        # 7. Seats
        seats = []
        for i in range(1, 11): # 10 seats in Room A
            seat = Seat(
                room_id=rm_a.id,
                seat_number=f"A{i:02d}",
                seat_type="PREMIUM" if i <= 2 else "STANDARD",
                description="Near window" if i <= 2 else "Standard seat",
                price=200.00 if i <= 2 else 100.00
            )
            seats.append(seat)
        db.add_all(seats)

        # 8. Time Slots
        slots = [
            (9, 10), (10, 11), (11, 12), (12, 13), 
            (14, 15), (15, 16), (16, 17)
        ]
        time_slots = []
        for start, end in slots:
            ts = TimeSlot(
                start_time=time(start, 0),
                end_time=time(end, 0)
            )
            time_slots.append(ts)
        db.add_all(time_slots)

        await db.commit()
        print("Seeded basic locations, branches, rooms, seats and time slots.")

if __name__ == "__main__":
    asyncio.run(seed_db())
