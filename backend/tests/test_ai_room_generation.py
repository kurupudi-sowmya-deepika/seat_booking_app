"""AI-assisted room generation - standalone test script (no pytest, matching this
repo's convention). Run with the venv active from `backend/`:

    python tests/test_ai_room_generation.py

Avoids real Gemini calls by monkeypatching `app.services.floor_plan_ai.get_model`
to return a `FakeMessagesListChatModel` subclassed with a no-op `bind_tools()` (the
base fake model doesn't implement it - see CLAUDE.md's chatbot-testing note for the
same pattern). Requires `scripts/seed.py` to have been run first (logs in as the
seeded admin@example.com).
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage

from app.main import app
from app.db.database import AsyncSessionLocal
from app.models.location import Facility
from app.services.floor_plan_ai import (
    classify_room, resolve_amenity, expand_furniture, place_furniture, rotated_aabb, aabb_overlap,
)
import app.services.floor_plan_ai as floor_plan_ai


class FakeStructuredModel(FakeMessagesListChatModel):
    """No-op bind_tools() so with_structured_output()'s tool-calling path works
    against a scripted response instead of a real API call."""
    def bind_tools(self, tools, **kwargs):
        return self


def install_fake_model(rooms: list, notes: str = "test notes"):
    """Patches app.services.floor_plan_ai.get_model (the name bound in that module's
    own namespace - patching langchain_service.get_model itself wouldn't affect an
    already-imported reference) to return a scripted structured-output response.
    Returns a restore function."""
    original = floor_plan_ai.get_model
    tool_call = {"name": "GeneratedRoomsPlan", "args": {"rooms": rooms, "notes": notes}, "id": "call_1"}
    fake = FakeStructuredModel(responses=[AIMessage(content="", tool_calls=[tool_call])])
    floor_plan_ai.get_model = lambda: fake
    return lambda: setattr(floor_plan_ai, "get_model", original)


def make_room(**overrides):
    room = {
        "name": "Nova", "room_number": "R-101", "capacity": 6, "shape": "RECTANGLE",
        "x": 50, "y": 50, "width": 200, "height": 150, "rotation": 0,
        "amenities": [], "door_side": "SOUTH", "has_window": False,
    }
    room.update(overrides)
    return room


async def run_unit_checks():
    print("\n[1] Testing classify_room() capacity boundaries...")
    assert classify_room(1) == ("MEETING_ROOM", "SMALL")
    assert classify_room(4) == ("MEETING_ROOM", "SMALL")
    assert classify_room(5) == ("MEETING_ROOM", "MEDIUM")
    assert classify_room(8) == ("MEETING_ROOM", "MEDIUM")
    assert classify_room(9) == ("MEETING_ROOM", "LARGE")
    assert classify_room(15) == ("MEETING_ROOM", "LARGE")
    assert classify_room(16) == ("CONFERENCE_ROOM", None)
    print("[OK] All capacity-bracket boundaries classify correctly.")

    print("\n[2] Testing resolve_amenity()...")
    async with AsyncSessionLocal() as db:
        marker_name = "Test AI Gen Ergonomic Chair"
        existing = Facility(name=marker_name, category="Furniture")
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        by_lower = {marker_name.lower(): existing}

        fid, warning = await resolve_amenity(db, marker_name.upper(), by_lower)
        assert fid == existing.id and warning is None, "Case-insensitive real-library match failed"
        print("[OK] Resolves a real Facility Library entry case-insensitively.")

        fid, warning = await resolve_amenity(db, "projector", by_lower)
        assert fid is not None and warning is None, f"Seed-catalog get-or-create failed: {warning}"
        assert by_lower["projector"].category == "Equipment"
        print("[OK] Seed-catalog amenity ('Projector') get-or-created with correct category.")

        fid2, warning2 = await resolve_amenity(db, "Projector", by_lower)
        assert fid2 == fid, "Second resolve of the same seed amenity created a duplicate instead of reusing it"
        print("[OK] Re-resolving the same seed amenity is idempotent (no duplicate row).")

        fid, warning = await resolve_amenity(db, "Nonexistent Amenity Xyz", by_lower)
        assert fid is None and warning, "Unrecognized amenity should be dropped with a warning"
        print("[OK] Unrecognized amenity is dropped with a warning, not fabricated.")

        # Cleanup the rows this test created.
        await db.delete(existing)
        seeded_projector = by_lower["projector"]
        await db.delete(seeded_projector)
        await db.commit()

    print("\n[3] Testing expand_furniture() shape/capacity rules...")
    expanded = expand_furniture(["Meeting Table", "Chairs", "Whiteboard"], capacity=6, shape="CIRCLE")
    assert expanded[0] == "Round Table", f"Expected a CIRCLE room to get a Round Table, got: {expanded}"
    assert expanded.count("Chairs") == 6, f"Expected 6 chairs for capacity 6, got: {expanded}"
    assert "Whiteboard" in expanded
    print("[OK] A CIRCLE room's 'Meeting Table' request is swapped for a Round Table.")

    expanded = expand_furniture(["Round Table", "Chairs"], capacity=20, shape="RECTANGLE")
    assert expanded[0] == "Meeting Table", f"Expected a RECTANGLE room to get a Meeting Table, got: {expanded}"
    assert expanded.count("Chairs") == 8, f"Expected chairs capped at 8 for capacity 20, got: {expanded}"
    print("[OK] A RECTANGLE room's 'Round Table' request is swapped for a Meeting Table; chairs capped at 8.")

    expanded = expand_furniture(["Meeting Table", "Chairs"], capacity=1, shape="RECTANGLE")
    assert "Meeting Table" not in expanded and "Round Table" not in expanded, f"Expected no table for capacity 1, got: {expanded}"
    assert expanded.count("Chairs") == 1
    print("[OK] A capacity-1 room gets no table (compact workstation instead).")

    print("\n[4] Testing place_furniture() shape dispatch stays within room bounds...")
    names = ["Round Table", "Chairs", "Chairs", "Chairs", "Chairs", "Whiteboard", "Camera"]
    room_x, room_y, room_w, room_h = 100.0, 100.0, 220.0, 220.0
    markers = place_furniture("CIRCLE", room_x, room_y, room_w, room_h, names)
    assert len(markers) == len(names), "Every furniture item must produce exactly one marker"
    room_aabb = (room_x, room_y, room_x + room_w, room_y + room_h)
    for name, m in zip(names, markers):
        marker_aabb = (m["x"], m["y"], m["x"] + m["width"], m["y"] + m["height"])
        assert marker_aabb[0] >= room_aabb[0] - 1 and marker_aabb[1] >= room_aabb[1] - 1, f"'{name}' marker starts outside the room: {m}"
        assert marker_aabb[2] <= room_aabb[2] + 1 and marker_aabb[3] <= room_aabb[3] + 1, f"'{name}' marker extends outside the room: {m}"
    # The table (first marker) should sit at the room's center, not out on the ring with the chairs.
    table_cx = markers[0]["x"] + markers[0]["width"] / 2
    table_cy = markers[0]["y"] + markers[0]["height"] / 2
    assert abs(table_cx - (room_x + room_w / 2)) < 1 and abs(table_cy - (room_y + room_h / 2)) < 1, "Table should be centered in a radial layout"
    print("[OK] Radial (CIRCLE) furniture layout keeps every marker inside the room, table centered.")

    l_markers = place_furniture("L_SHAPE", room_x, room_y, room_w, room_h, names)
    assert len(l_markers) == len(names)
    print("[OK] L_SHAPE furniture layout produces one marker per item without erroring.")


async def run_http_checks():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n[5] Authenticating as admin...")
        login_res = await client.post("/api/auth/login", data={"username": "admin@example.com", "password": "admin123"})
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

        branches = (await client.get("/api/branches/", headers=headers)).json()
        assert branches, "No branches found - run scripts/seed.py first"
        branch_id = branches[0]["id"]

        print("\n[6] Creating a scratch floor for generation tests...")
        floor_res = await client.post(
            "/api/floor-plans/floors",
            json={"branch_id": branch_id, "name": "AI Gen Test Floor", "floor_number": 99,
                  "canvas_width": 800, "canvas_height": 600},
            headers=headers,
        )
        assert floor_res.status_code == 200, f"Floor creation failed: {floor_res.text}"
        floor = floor_res.json()
        floor_id = floor["id"]

        try:
            print("\n[7] Testing a clean generation (no overlap, in bounds)...")
            restore = install_fake_model([make_room(name="Nova", room_number="AI-1")])
            try:
                res = await client.post(f"/api/floor-plans/floors/{floor_id}/generate-rooms", json={}, headers=headers)
            finally:
                restore()
            assert res.status_code == 200, f"Generate failed: {res.text}"
            data = res.json()
            assert len(data["rooms"]) == 1
            errors = [i for i in data["issues"] if i["severity"] == "error"]
            assert not errors, f"Expected no errors on a clean generation, got: {errors}"
            door_children = [c for c in data["rooms"][0]["children"] if c["item_type"] == "DOOR"]
            assert len(door_children) == 1, "Every generated room must have exactly one door"
            print("[OK] Clean generation produced one valid room with a door and zero errors.")

            print("\n[8] Testing an out-of-canvas room (bounds error)...")
            restore = install_fake_model([make_room(name="Orion", room_number="AI-2", x=700, y=500, width=300, height=200)])
            try:
                res = await client.post(f"/api/floor-plans/floors/{floor_id}/generate-rooms", json={}, headers=headers)
            finally:
                restore()
            assert res.status_code == 200, f"Generate failed: {res.text}"
            data = res.json()
            errors = [i for i in data["issues"] if i["severity"] == "error"]
            assert any("floor boundary" in i["message"] for i in errors), f"Expected a bounds error, got: {data['issues']}"
            print("[OK] Out-of-canvas room correctly flagged as an error.")

            print("\n[9] Testing two overlapping proposed rooms (overlap warning)...")
            restore = install_fake_model([
                make_room(name="Aurora", room_number="AI-3", x=50, y=50, width=200, height=150),
                make_room(name="Vertex", room_number="AI-4", x=100, y=80, width=200, height=150),
            ])
            try:
                res = await client.post(f"/api/floor-plans/floors/{floor_id}/generate-rooms", json={}, headers=headers)
            finally:
                restore()
            assert res.status_code == 200, f"Generate failed: {res.text}"
            data = res.json()
            warnings = [i for i in data["issues"] if i["severity"] == "warning"]
            assert any("overlaps proposed room" in i["message"] for i in warnings), f"Expected an overlap warning, got: {data['issues']}"
            print("[OK] Overlapping proposed rooms correctly flagged as a warning (not blocked).")

            print("\n[10] Testing a circular room end-to-end (shape-aware furniture)...")
            restore = install_fake_model([make_room(
                name="Zenith", room_number="AI-5", shape="CIRCLE", x=400, y=50, width=180, height=180,
                capacity=6, amenities=["Meeting Table", "Chairs", "Whiteboard", "Camera"],
            )])
            try:
                res = await client.post(f"/api/floor-plans/floors/{floor_id}/generate-rooms", json={}, headers=headers)
            finally:
                restore()
            assert res.status_code == 200, f"Generate failed: {res.text}"
            data = res.json()
            room = data["rooms"][0]
            assert room["room"]["shape"] == "CIRCLE"
            facility_children = [c for c in room["children"] if c["item_type"] == "FACILITY"]
            # 1 Round Table (swapped from "Meeting Table" since this is a CIRCLE room) + 6 Chairs + Whiteboard + Camera
            assert len(facility_children) == 9, f"Expected 9 furniture markers, got {len(facility_children)}: {[c['label'] for c in facility_children]}"
            assert facility_children[0]["label"] == "Round Table", f"Expected the table swapped for 'Round Table' in a circular room, got: {facility_children[0]['label']}"
            assert sum(1 for c in facility_children if c["label"] == "Chairs") == 6
            errors = [i for i in data["issues"] if i["severity"] == "error"]
            assert not errors, f"Expected no errors for a well-formed circular room, got: {errors}"
            print("[OK] Circular room generated 1 Round Table + 6 Chairs + equipment, arranged radially, zero errors.")
        finally:
            print("\n[11] Cleaning up the scratch floor...")
            del_res = await client.delete(f"/api/floor-plans/floors/{floor_id}", headers=headers)
            assert del_res.status_code in (200, 204), f"Cleanup failed: {del_res.text}"
            print("[OK] Scratch floor removed.")


async def main():
    print("==================================================")
    print("   AI ROOM GENERATION TEST SUITE                  ")
    print("==================================================")
    await run_unit_checks()
    await run_http_checks()
    print("\n==================================================")
    print("   ALL AI ROOM GENERATION TESTS PASSED!           ")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
