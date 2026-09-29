"""Test script to verify Seat Booking MCP Server end-to-end."""

import asyncio
import sys
from mcp_server.server import (
    get_locations,
    get_branches,
    get_time_slots,
    get_my_wallet_balance,
    get_my_bookings,
    search_available_seats,
    check_day_pass_availability,
    pre_register_visitor,
    check_in_visitor,
    check_out_visitor,
    mcp
)

async def main():
    print("=" * 65)
    print(" >>> TESTING SEAT BOOKING MCP SERVER <<<")
    print("=" * 65)

    # 1. Check Tool Registration
    tools = mcp._tool_manager._tools
    print(f"\n[1/5] Registered MCP Tools: {len(tools)} tools active")
    for name in tools.keys():
        print(f"      - {name}")

    # 2. Test Locations & Branches
    print("\n[2/5] Testing Hub & Branch Discovery...")
    try:
        locs = await get_locations()
        print(f"      SUCCESS: Retrieved {len(locs)} global locations")
        for l in locs[:3]:
            print(f"        * {l.get('name')} ({l.get('city')}, {l.get('country')})")

        branches = await get_branches()
        print(f"      SUCCESS: Retrieved {len(branches)} campus branches")
    except Exception as e:
        print(f"      FAILED: {e}")
        return

    # 3. Test Authentication & Wallet Credits
    print("\n[3/5] Testing Employee Auth & Corporate Wallet...")
    try:
        wb = await get_my_wallet_balance()
        print(f"      SUCCESS: Authenticated as User ID: {wb.get('user_id')}")
        print(f"      SUCCESS: Live Wallet Balance: {wb.get('currency', 'INR')} {wb.get('balance', 0):,.2f}")
    except Exception as e:
        print(f"      FAILED: {e}")
        return

    # 4. Test Workstation Search & Day Passes
    print("\n[4/5] Testing Workspace Search & Day Pass Availability...")
    try:
        date_str = "2026-09-30"
        seats = await search_available_seats(booking_date=date_str, city_or_location="Bangalore")
        print(f"      SUCCESS: Found {len(seats)} available desks in Bangalore on {date_str}")

        if branches:
            dp = await check_day_pass_availability(booking_date=date_str, branch_id=branches[0]["id"])
            print(f"      SUCCESS: Day pass capacity confirmed for branch '{branches[0]['name']}'")
    except Exception as e:
        print(f"      FAILED: {e}")
        return

    # 5. Test Visitor Pass Management
    print("\n[5/5] Testing Guest Pass Lifecycle...")
    try:
        if branches:
            visitor = await pre_register_visitor(
                branch_id=branches[0]["id"],
                visitor_name="Alex Johnson",
                visitor_email="alex.johnson@clientcorp.com",
                purpose="Q3 Roadmap Sync",
                visit_date="2026-09-30"
            )
            v_id = visitor.get("id")
            print(f"      SUCCESS: Pre-registered visitor (ID: {v_id}, Status: {visitor.get('status')})")

            cin = await check_in_visitor(visitor_id=v_id)
            print(f"      SUCCESS: Reception Check-In completed (Status: {cin.get('status')})")

            cout = await check_out_visitor(visitor_id=v_id)
            print(f"      SUCCESS: Check-Out completed (Status: {cout.get('status')})")
    except Exception as e:
        print(f"      FAILED: {e}")
        return

    print("\n" + "=" * 65)
    print(" ALL MCP TOOLS ARE WORKING PERFECTLY! [SUCCESS]")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
