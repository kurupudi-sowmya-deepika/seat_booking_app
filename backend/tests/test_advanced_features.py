import asyncio
import os
import sys
from datetime import date, time, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from app.main import app

async def run_advanced_tests():
    print("==================================================")
    print("   SEATSYNC ADVANCED SUITE & AI INTELLIGENCE TEST ")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login
        print("\n[1] Authenticating Test Sessions...")
        admin_res = await client.post("/api/auth/login", data={"username": "admin@example.com", "password": "admin123"})
        admin_token = admin_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        user_res = await client.post("/api/auth/login", data={"username": "user@example.com", "password": "user123"})
        user_token = user_res.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        print("[OK] Admin and User tokens acquired.")

        # 2. Test Locations, Branches, Rooms & Slots
        locs = (await client.get("/api/locations/")).json()
        branches = (await client.get("/api/branches/")).json()
        rooms = (await client.get("/api/rooms/")).json()
        seats = (await client.get("/api/seats/")).json()
        slots = (await client.get("/api/time-slots/")).json()

        test_branch = branches[0]
        test_loc = locs[0]
        # Must be a MEETING_ROOM in test_branch specifically - create_booking rejects a
        # room/branch mismatch or a room whose room_type doesn't match the booking_type.
        test_room = next(
            (r for r in rooms if r.get("room_type") == "MEETING_ROOM" and r.get("branch_id") == test_branch["id"]),
            None
        )

        # 3. Test Visitor Management
        print("\n[2] Testing Visitor Pre-registration, Check-in & Check-out...")
        visitor_payload = {
            "branch_id": test_branch["id"],
            "visitor_name": "Satya Nadella",
            "visitor_email": "satya@partner-corp.com",
            "visitor_phone": "+91 98877 66554",
            "purpose": "Executive Partnership Discussion",
            "visit_date": str(date.today() + timedelta(days=2)),
            "expected_arrival_time": "11:00:00"
        }
        v_res = await client.post("/api/visitors/", json=visitor_payload, headers=user_headers)
        assert v_res.status_code == 200, f"Visitor creation failed: {v_res.text}"
        visitor = v_res.json()
        visitor_id = visitor["id"]
        print(f"[OK] Visitor pre-registered: {visitor['visitor_name']} (Status: {visitor['status']})")

        # Check-in
        ci_res = await client.post(f"/api/visitors/{visitor_id}/check-in", headers=user_headers)
        assert ci_res.status_code == 200
        assert ci_res.json()["status"] == "CHECKED_IN"
        print(f"[OK] Visitor checked in successfully.")

        # Check-out
        co_res = await client.post(f"/api/visitors/{visitor_id}/check-out", headers=user_headers)
        assert co_res.status_code == 200
        assert co_res.json()["status"] == "CHECKED_OUT"
        print(f"[OK] Visitor checked out successfully.")

        # 4. Test Notification Center
        print("\n[3] Testing In-App Notification Center...")
        notif_res = await client.get("/api/notifications/", headers=user_headers)
        assert notif_res.status_code == 200
        notifs_data = notif_res.json()
        print(f"[OK] Notifications retrieved: {len(notifs_data['notifications'])} total (Unread: {notifs_data['unread_count']})")

        # Mark all read
        read_all = await client.post("/api/notifications/read-all", headers=user_headers)
        assert read_all.status_code == 200
        print("[OK] All notifications marked as read.")

        # 5. Test Alternative Resource Suggestions
        print("\n[4] Testing Alternative Resource Suggestions Engine...")
        alt_res = await client.get(
            f"/api/bookings/alternatives?branch_id={test_branch['id']}&booking_date=2026-12-01&resource_type=SEAT",
            headers=user_headers
        )
        assert alt_res.status_code == 200
        alt_data = alt_res.json()
        print(f"[OK] Alternatives found: {len(alt_data['alternatives'])} options (Message: {alt_data['message']})")

        # 6. Test Hourly Meeting Room Booking & Extension
        if test_room:
            print("\n[5] Testing Hourly Meeting Room Booking & Extension...")
            room_payload = {
                "booking_type": "MEETING_ROOM",
                "location_id": test_loc["id"],
                "branch_id": test_branch["id"],
                "room_id": test_room["id"],
                "booking_date": "2026-12-05",
                "start_time": "14:00:00",
                "end_time": "15:00:00"
            }
            rm_book_res = await client.post("/api/bookings/", json=room_payload, headers=user_headers)
            assert rm_book_res.status_code in [200, 201], f"Room booking failed: {rm_book_res.text}"
            rm_booking = rm_book_res.json()
            rm_booking_id = rm_booking["id"]
            print(f"[OK] Room reservation created: {test_room['name']} from 14:00 to 15:00 (ID: {rm_booking_id})")

            # Extend duration by +1 hour
            extend_payload = {"additional_hours": 1}
            ext_res = await client.post(f"/api/bookings/{rm_booking_id}/extend", json=extend_payload, headers=user_headers)
            assert ext_res.status_code == 200, f"Extension failed: {ext_res.text}"
            extended_booking = ext_res.json()
            assert extended_booking["end_time"] == "16:00:00", "End time mismatch after extension"
            print(f"[OK] Room extended until: {extended_booking['end_time']} (New total: INR {extended_booking['amount']})")

            # 7. Test Outlook / iCal Export
            print("\n[6] Testing Outlook (.ics) iCalendar Generation...")
            ical_res = await client.get(f"/api/bookings/{rm_booking_id}/ical", headers=user_headers)
            assert ical_res.status_code == 200
            assert "BEGIN:VCALENDAR" in ical_res.text
            assert "UID:" in ical_res.text
            print(f"[OK] Outlook .ics generated ({len(ical_res.text)} bytes). Content snippet: {ical_res.text[:80]}...")

            # Clean up so re-running this script doesn't collide with the fixed test slot above
            cancel_res = await client.post(f"/api/bookings/{rm_booking_id}/cancel", headers=user_headers)
            assert cancel_res.status_code == 200, f"Room booking cleanup cancel failed: {cancel_res.text}"

        # 8. Test Admin Reports & Revenue Analytics
        print("\n[7] Testing Admin Revenue Reports & Analytics...")
        rev_res = await client.get("/api/reports/revenue", headers=admin_headers)
        assert rev_res.status_code == 200
        rev_data = rev_res.json()
        print(f"[OK] Total Revenue on file: INR {rev_data['total_revenue']} across {rev_data['total_confirmed_bookings']} bookings.")

        occ_res = await client.get("/api/reports/occupancy", headers=admin_headers)
        assert occ_res.status_code == 200
        occ_data = occ_res.json()
        print(f"[OK] Seat Occupancy: {occ_data['overall_seat_occupancy']}% | Room Utilization: {occ_data['overall_room_utilization']}%")

        # 9. Test CSV Export
        print("\n[8] Testing CSV Report Export...")
        csv_res = await client.get("/api/reports/export", headers=admin_headers)
        assert csv_res.status_code == 200
        assert "Booking ID,Date,Booking Type" in csv_res.text
        print(f"[OK] CSV Export verified ({len(csv_res.text.splitlines())} lines exported).")

        print("\n==================================================")
        print("   ALL ADVANCED ENTERPRISE SUITE TESTS PASSED!    ")
        print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_advanced_tests())
