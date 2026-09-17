"""Isometric 3D-style floor management upgrade - standalone test script (no pytest,
matching this repo's convention). Run with the venv active from `backend/`:

    python tests/test_floor_management_upgrade.py

Covers: the new seat-overlap/seat-outside-room validation checks, the `elevation`
column round-tripping through save, and the new Admin AI floor-management tools
(list_floors, stage_add_desks_to_floor, stage_move_room_to_zone) called directly
(no LLM involved - these are plain async methods, exercised the same way
test_chatbot_split.py already exercises AdminChatbotTools.list_rooms).
"""
import asyncio
import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.schemas.floor_plan import FloorLayoutItemCreate
from app.api.routes.floor_plans import _validate_items
from app.chatbot.admin_tools import AdminChatbotTools


def make_item(**overrides):
    base = dict(
        id=uuid4(), item_type="SEAT", parent_item_id=None, zone_item_id=None,
        label=None, color=None, x=0, y=0, width=40, height=40, rotation=0,
        shape="SQUARE", z_index=1, elevation=0, properties={"seat_number": "T01"},
    )
    base.update(overrides)
    return FloorLayoutItemCreate(**base)


async def run_unit_checks():
    print("\n[1] Testing seat-vs-seat overlap validation...")
    room_id = uuid4()
    room = make_item(id=room_id, item_type="ROOM", x=0, y=0, width=300, height=300, properties={"name": "Test Room"})
    seat_a = make_item(x=50, y=50, parent_item_id=room_id, properties={"seat_number": "A1"})
    seat_b = make_item(x=60, y=60, parent_item_id=room_id, properties={"seat_number": "A2"})  # overlaps seat_a
    issues = _validate_items([room, seat_a, seat_b], 1200, 800)
    assert any("overlaps seat" in i.message for i in issues), f"Expected a seat-overlap issue, got: {issues}"
    print("[OK] Two overlapping seats are flagged.")

    print("\n[2] Testing non-overlapping seats pass cleanly...")
    seat_c = make_item(x=200, y=200, parent_item_id=room_id, properties={"seat_number": "A3"})
    issues = _validate_items([room, seat_a, seat_c], 1200, 800)
    assert not any("overlaps seat" in i.message for i in issues), f"Expected no overlap issue, got: {issues}"
    print("[OK] Non-overlapping seats in the same room pass cleanly.")

    print("\n[3] Testing seat-outside-room-boundary validation...")
    seat_outside = make_item(x=280, y=280, width=40, height=40, parent_item_id=room_id, properties={"seat_number": "A4"})
    issues = _validate_items([room, seat_outside], 1200, 800)
    assert any("outside its room's boundary" in i.message for i in issues), f"Expected an outside-room issue, got: {issues}"
    print("[OK] A seat extending past its parent room's boundary is flagged.")

    print("\n[4] Testing a fully-contained seat passes cleanly...")
    seat_inside = make_item(x=100, y=100, width=40, height=40, parent_item_id=room_id, properties={"seat_number": "A5"})
    issues = _validate_items([room, seat_inside], 1200, 800)
    assert not any("outside its room's boundary" in i.message for i in issues), f"Expected no boundary issue, got: {issues}"
    print("[OK] A seat fully inside its parent room passes cleanly.")


async def run_http_checks():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n[5] Authenticating as admin...")
        login = await client.post("/api/auth/login", data={"username": "admin@example.com", "password": "admin123"})
        assert login.status_code == 200, f"Admin login failed: {login.text}"
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        branches = (await client.get("/api/branches/", headers=headers)).json()
        assert branches, "No branches found - run scripts/seed.py first"
        branch_id = branches[0]["id"]
        branch_name = branches[0]["name"]

        print("\n[6] Creating a scratch floor and verifying `elevation` round-trips through save...")
        floor_res = await client.post(
            "/api/floor-plans/floors",
            json={"branch_id": branch_id, "name": "Elevation Test Floor", "floor_number": 88,
                  "canvas_width": 800, "canvas_height": 600},
            headers=headers,
        )
        assert floor_res.status_code == 200, f"Floor creation failed: {floor_res.text}"
        floor_id = floor_res.json()["id"]

        try:
            item_id = str(uuid4())
            save_res = await client.post(
                f"/api/floor-plans/floors/{floor_id}/save",
                json={"items": [{
                    "id": item_id, "item_type": "WALL", "x": 10, "y": 10, "width": 200, "height": 10,
                    "rotation": 0, "shape": "RECTANGLE", "z_index": 2, "elevation": 95,
                }]},
                headers=headers,
            )
            assert save_res.status_code == 200 and save_res.json()["success"], f"Save failed: {save_res.text}"
            saved_item = save_res.json()["items"][0]
            assert saved_item["elevation"] == 95, f"Expected elevation=95 to round-trip, got: {saved_item.get('elevation')}"
            print("[OK] `elevation` persists through save and comes back unchanged.")

            print("\n[7] Testing AdminChatbotTools.list_floors() directly (no LLM)...")
            async with AsyncSessionLocal() as db:
                admin = (await db.execute(select(User).where(User.email == "admin@example.com"))).scalar_one()
                admin_tools = AdminChatbotTools(db=db, current_user=admin)
                floors = await admin_tools.list_floors(branch_name=branch_name)
                assert any(f["name"] == "Elevation Test Floor" for f in floors), f"Expected the scratch floor in list_floors(), got: {floors}"
                print(f"[OK] list_floors(branch_name='{branch_name}') includes the scratch floor.")

                print("\n[8] Testing AdminChatbotTools.stage_add_desks_to_floor() stages (does not persist) new seats...")
                # Give the floor a workspace room to add desks into, matching what the
                # editor's "Add Seat" flow auto-creates on first use.
                workspace_id = str(uuid4())
                await client.post(
                    f"/api/floor-plans/floors/{floor_id}/save",
                    json={"items": [
                        {"id": item_id, "item_type": "WALL", "x": 10, "y": 10, "width": 200, "height": 10, "rotation": 0, "shape": "RECTANGLE", "z_index": 2, "elevation": 95},
                        {"id": workspace_id, "item_type": "ROOM", "x": 0, "y": 0, "width": 800, "height": 600, "rotation": 0, "shape": "RECTANGLE", "z_index": 0,
                         "properties": {"name": "Open Workspace", "room_type": "WORKSPACE", "capacity": 999, "is_default_workspace": True}},
                    ]},
                    headers=headers,
                )
                staged = await admin_tools.stage_add_desks_to_floor(floor_name="Elevation Test Floor", count=5, branch_name=branch_name)
                assert staged.get("action") == "REQUIRE_ADMIN_ACTION_CONFIRMATION", f"Expected a staged proposal, got: {staged}"
                new_items = staged["payload"]["new_items"]
                assert len(new_items) == 5, f"Expected 5 staged seats, got {len(new_items)}"
                assert all(i["item_type"] == "SEAT" and i["parent_item_id"] == workspace_id for i in new_items)

                # Confirm nothing was persisted by the stage_* call itself.
                draft_after = (await client.get(f"/api/floor-plans/floors/{floor_id}/layout", params={"draft": True}, headers=headers)).json()
                assert not any(i["item_type"] == "SEAT" for i in draft_after), "stage_add_desks_to_floor must not persist anything by itself"
                print("[OK] stage_add_desks_to_floor() proposes 5 new seats without persisting them (admin confirmation required).")

                print("\n[9] Testing AdminChatbotTools.stage_move_room_to_zone()...")
                zone_id = str(uuid4())
                await client.post(
                    f"/api/floor-plans/floors/{floor_id}/save",
                    json={"items": [
                        {"id": workspace_id, "item_type": "ROOM", "x": 0, "y": 0, "width": 800, "height": 600, "rotation": 0, "shape": "RECTANGLE", "z_index": 0,
                         "properties": {"name": "Open Workspace", "room_type": "WORKSPACE", "capacity": 999, "is_default_workspace": True}},
                        {"id": zone_id, "item_type": "ZONE", "x": 0, "y": 0, "width": 200, "height": 200, "rotation": 0, "shape": "RECTANGLE", "z_index": -1, "label": "Zone B"},
                    ]},
                    headers=headers,
                )
                move_staged = await admin_tools.stage_move_room_to_zone(room_name="Open Workspace", zone_name="Zone B", floor_name="Elevation Test Floor")
                assert move_staged.get("action") == "REQUIRE_ADMIN_ACTION_CONFIRMATION", f"Expected a staged proposal, got: {move_staged}"
                assert move_staged["payload"]["zone_item_id"] == zone_id
                print("[OK] stage_move_room_to_zone() proposes the reassignment without persisting it.")
        finally:
            print("\n[10] Cleaning up the scratch floor...")
            del_res = await client.delete(f"/api/floor-plans/floors/{floor_id}", headers=headers)
            assert del_res.status_code in (200, 204), f"Cleanup failed: {del_res.text}"
            print("[OK] Scratch floor removed.")


async def main():
    print("==================================================")
    print("   FLOOR MANAGEMENT UPGRADE TEST SUITE            ")
    print("==================================================")
    await run_unit_checks()
    await run_http_checks()
    print("\n==================================================")
    print("   ALL FLOOR MANAGEMENT UPGRADE TESTS PASSED!     ")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
