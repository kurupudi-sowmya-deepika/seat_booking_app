import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User

async def run_tests():
    print("========================================")
    print("   SEATSYNC END-TO-END TEST SUITE       ")
    print("========================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test Admin Login
        print("\n[1] Testing Admin Authentication...")
        login_res = await client.post(
            "/api/auth/login",
            data={"username": "admin@example.com", "password": "admin123"}
        )
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        admin_data = login_res.json()
        admin_token = admin_data["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        admin_me = await client.get("/api/auth/me", headers=admin_headers)
        assert admin_me.status_code == 200
        admin_user = admin_me.json()
        print(f"[OK] Admin logged in successfully: {admin_user['name']} (Role: {admin_user['role']})")

        # 2. Test User Login
        print("\n[2] Testing Regular User Authentication...")
        user_login = await client.post(
            "/api/auth/login",
            data={"username": "user@example.com", "password": "user123"}
        )
        assert user_login.status_code == 200, f"User login failed: {user_login.text}"
        user_data = user_login.json()
        user_token = user_data["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}

        user_me = await client.get("/api/auth/me", headers=user_headers)
        assert user_me.status_code == 200
        user_user = user_me.json()
        print(f"[OK] User logged in successfully: {user_user['name']} (Role: {user_user['role']})")

        # 3. Test Nearest Location Calculation (Haversine Bangalore GPS)
        print("\n[3] Testing Nearest Location Detection (Bangalore GPS)...")
        near_res = await client.get("/api/locations/nearest?lat=12.9716&lon=77.5946")
        assert near_res.status_code == 200, f"Nearest location failed: {near_res.text}"
        near_data = near_res.json()
        print(f"[OK] Nearest Location detected: {near_data['location']['name']} ({near_data['location']['city']}) - Distance: {near_data.get('distance_km', 'N/A')} km")

        # 4. Test Locations, Branches, Rooms & Seats
        print("\n[4] Testing Workspace Hierarchy...")
        locs_res = await client.get("/api/locations/")
        assert locs_res.status_code == 200
        locs = locs_res.json()
        assert len(locs) > 0, "No locations found"
        print(f"[OK] Locations count: {len(locs)}")

        branches_res = await client.get("/api/branches/")
        assert branches_res.status_code == 200
        branches = branches_res.json()
        assert len(branches) > 0, "No branches found"
        print(f"[OK] Branches count: {len(branches)}")

        rooms_res = await client.get("/api/rooms/")
        assert rooms_res.status_code == 200
        rooms = rooms_res.json()
        print(f"[OK] Rooms count: {len(rooms)}")

        seats_res = await client.get("/api/seats/")
        assert seats_res.status_code == 200
        seats = seats_res.json()
        print(f"[OK] Seats count: {len(seats)}")

        slots_res = await client.get("/api/time-slots/")
        assert slots_res.status_code == 200
        slots = slots_res.json()
        print(f"[OK] Time slots count: {len(slots)}")

        # 5. Test Wallet Balance
        print("\n[5] Testing User Wallet Balance...")
        wallet_res = await client.get("/api/wallet/balance", headers=user_headers)
        assert wallet_res.status_code == 200, f"Wallet balance failed: {wallet_res.text}"
        initial_balance = wallet_res.json()["balance"]
        print(f"[OK] Current User Wallet Balance: INR {initial_balance}")

        # 6. Test SpaceHub Creation
        print("\n[6] Testing SpaceHub Creation with Wallet Deduction...")
        test_seat = seats[0]
        test_slot = slots[0]
        target_branch = branches[0]
        target_loc = locs[0]

        booking_payload = {
            "booking_type": "SEAT",
            "location_id": target_loc["id"],
            "branch_id": target_branch["id"],
            "room_id": test_seat["room_id"],
            "seat_id": test_seat["id"],
            "time_slot_id": test_slot["id"],
            "booking_date": "2026-11-20",
            "notes": "E2E automated test reservation"
        }

        book_res = await client.post("/api/bookings/", json=booking_payload, headers=user_headers)
        assert book_res.status_code in [200, 201], f"Booking failed: {book_res.text}"
        booking = book_res.json()
        booking_id = booking["id"]
        total_price = float(booking.get("amount", booking.get("total_price", 0)))
        print(f"[OK] Booking created successfully! Booking ID: {booking_id}, Amount Charged: INR {total_price}")

        # Verify Wallet Deduction
        wallet_res_after = await client.get("/api/wallet/balance", headers=user_headers)
        new_balance = wallet_res_after.json()["balance"]
        expected_balance = initial_balance - total_price
        assert new_balance == expected_balance, f"Wallet deduction mismatch! Expected {expected_balance}, got {new_balance}"
        print(f"[OK] Wallet correctly debited: INR {initial_balance} -> INR {new_balance}")

        # 7. Test User Booking History
        print("\n[7] Testing User Booking History...")
        my_res = await client.get("/api/bookings/my", headers=user_headers)
        assert my_res.status_code == 200
        my_bookings = my_res.json()
        assert any(b["id"] == booking_id for b in my_bookings), "Created booking not found in /my bookings"
        print(f"[OK] User booking history verified ({len(my_bookings)} bookings on file)")

        # 8. Test Cancellation & Instant Wallet Refund
        print("\n[8] Testing Booking Cancellation & Instant Wallet Refund...")
        cancel_res = await client.post(f"/api/bookings/{booking_id}/cancel", headers=user_headers)
        assert cancel_res.status_code == 200, f"Cancellation failed: {cancel_res.text}"
        cancel_data = cancel_res.json()
        print(f"[OK] Booking status updated: {cancel_data['status']}")

        # Verify Refund back to Wallet
        wallet_res_refunded = await client.get("/api/wallet/balance", headers=user_headers)
        refunded_balance = wallet_res_refunded.json()["balance"]
        assert refunded_balance == initial_balance, f"Refund mismatch! Expected INR {initial_balance}, got INR {refunded_balance}"
        print(f"[OK] 100% instant refund verified! Balance restored to INR {refunded_balance}")

        # 9. Test Admin Statistics
        print("\n[9] Testing Admin Statistics & KPI Dashboard...")
        stats_res = await client.get("/api/admin/stats", headers=admin_headers)
        assert stats_res.status_code == 200, f"Admin stats failed: {stats_res.text}"
        stats = stats_res.json()
        print(f"[OK] Admin KPIs: Total Users: {stats['total_users']}, Total Bookings: {stats['total_bookings']}, Total In Circulation: INR {stats.get('total_wallet_credits', 0)}")

        # 10. Test Admin Wallet Manual Adjustment with Audit Trail
        print("\n[10] Testing Admin Manual Wallet Adjustment...")
        adjust_payload = {
            "user_id": user_user["id"],
            "amount": 250,
            "transaction_type": "CREDIT",
            "reason": "Customer Goodwill Bonus / System Verification"
        }
        adjust_res = await client.post("/api/wallet/admin/adjust", json=adjust_payload, headers=admin_headers)
        assert adjust_res.status_code == 200, f"Admin adjust failed: {adjust_res.text}"
        adjust_data = adjust_res.json()
        assert adjust_data["balance_after"] == initial_balance + 250, "Adjusted balance mismatch"
        print(f"[OK] Admin adjustment committed: INR {initial_balance} -> INR {adjust_data['balance_after']} (Reason: {adjust_payload['reason']})")

        # 11. Test Chatbot Endpoint
        print("\n[11] Testing AI Concierge Tool Pipeline...")
        chat_payload = {
            "message": "What branches do you have in Bangalore?"
        }
        chat_res = await client.post("/api/chatbot/chat", json=chat_payload, headers=user_headers)
        assert chat_res.status_code == 200, f"Chatbot call failed: {chat_res.text}"
        chat_data = chat_res.json()
        print(f"[OK] AI Concierge Response: {chat_data['message'][:120]}...")

        print("\n========================================")
        print("   ALL 11 END-TO-END TESTS PASSED!       ")
        print("========================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
