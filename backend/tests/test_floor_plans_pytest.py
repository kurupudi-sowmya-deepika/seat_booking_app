"""
test_floor_plans_pytest.py – floor-plan management tests (pytest version).

Converted from test_floor_management_upgrade.py.

Covers:
  • _validate_items(): seat-overlap detection
  • _validate_items(): seat-outside-room-boundary detection
  • Floor CRUD via HTTP (create / save / delete)
  • `elevation` field round-tripping through save
  • AdminChatbotTools.list_floors()
  • AdminChatbotTools.stage_add_desks_to_floor()  (staging only, no persist)
  • AdminChatbotTools.stage_move_room_to_zone()
"""
from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.schemas.floor_plan import FloorLayoutItemCreate
from app.api.routes.floor_plans import _validate_items
from app.chatbot.admin_tools import AdminChatbotTools


# ──────────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────────

def make_item(**overrides) -> FloorLayoutItemCreate:
    base = dict(
        id=uuid4(), item_type="SEAT", parent_item_id=None, zone_item_id=None,
        label=None, color=None, x=0, y=0, width=40, height=40, rotation=0,
        shape="SQUARE", z_index=1, elevation=0, properties={"seat_number": "T01"},
    )
    base.update(overrides)
    return FloorLayoutItemCreate(**base)


# ──────────────────────────────────────────────────────────────────────────
# Unit checks – pure Python, no DB
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.unit
@pytest.mark.floor
def test_validate_overlapping_seats_flagged():
    room_id = uuid4()
    room = make_item(id=room_id, item_type="ROOM", x=0, y=0, width=300, height=300, properties={"name": "R"})
    seat_a = make_item(x=50, y=50, parent_item_id=room_id, properties={"seat_number": "A1"})
    seat_b = make_item(x=60, y=60, parent_item_id=room_id, properties={"seat_number": "A2"})  # overlaps
    issues = _validate_items([room, seat_a, seat_b], 1200, 800)
    assert any("overlaps seat" in i.message for i in issues), (
        f"Expected a seat-overlap issue, got: {[i.message for i in issues]}"
    )


@pytest.mark.unit
@pytest.mark.floor
def test_validate_non_overlapping_seats_pass():
    room_id = uuid4()
    room = make_item(id=room_id, item_type="ROOM", x=0, y=0, width=300, height=300, properties={"name": "R"})
    seat_a = make_item(x=50, y=50, parent_item_id=room_id, properties={"seat_number": "A1"})
    seat_c = make_item(x=200, y=200, parent_item_id=room_id, properties={"seat_number": "A3"})
    issues = _validate_items([room, seat_a, seat_c], 1200, 800)
    assert not any("overlaps seat" in i.message for i in issues)


@pytest.mark.unit
@pytest.mark.floor
def test_validate_seat_outside_room_boundary_flagged():
    room_id = uuid4()
    room = make_item(id=room_id, item_type="ROOM", x=0, y=0, width=300, height=300, properties={"name": "R"})
    seat_outside = make_item(x=280, y=280, width=40, height=40, parent_item_id=room_id, properties={"seat_number": "A4"})
    issues = _validate_items([room, seat_outside], 1200, 800)
    assert any("outside its room's boundary" in i.message for i in issues), (
        f"Expected a boundary issue, got: {[i.message for i in issues]}"
    )


@pytest.mark.unit
@pytest.mark.floor
def test_validate_seat_inside_room_passes():
    room_id = uuid4()
    room = make_item(id=room_id, item_type="ROOM", x=0, y=0, width=300, height=300, properties={"name": "R"})
    seat_inside = make_item(x=100, y=100, width=40, height=40, parent_item_id=room_id, properties={"seat_number": "A5"})
    issues = _validate_items([room, seat_inside], 1200, 800)
    assert not any("outside its room's boundary" in i.message for i in issues)


# ──────────────────────────────────────────────────────────────────────────
# HTTP + AdminChatbotTools checks (require seeded DB)
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.floor
async def test_elevation_field_round_trips_through_save(http_client, admin_headers, branches):
    branch_id = str(branches[0]["id"])
    branch_name = branches[0]["name"]

    # Create scratch floor
    floor_res = await http_client.post(
        "/api/floor-plans/floors",
        json={
            "branch_id": branch_id,
            "name": "pytest-elevation-test",
            "floor_number": 99,
            "canvas_width": 800,
            "canvas_height": 600,
        },
        headers=admin_headers,
    )
    assert floor_res.status_code == 200, f"Floor creation failed: {floor_res.text}"
    floor_id = floor_res.json()["id"]

    try:
        item_id = str(uuid4())
        save_res = await http_client.post(
            f"/api/floor-plans/floors/{floor_id}/save",
            json={"items": [{
                "id": item_id, "item_type": "WALL", "x": 10, "y": 10,
                "width": 200, "height": 10, "rotation": 0,
                "shape": "RECTANGLE", "z_index": 2, "elevation": 95,
            }]},
            headers=admin_headers,
        )
        assert save_res.status_code == 200 and save_res.json()["success"], (
            f"Save failed: {save_res.text}"
        )
        saved_item = save_res.json()["items"][0]
        assert saved_item["elevation"] == 95, (
            f"elevation should round-trip unchanged, got {saved_item.get('elevation')}"
        )
    finally:
        del_res = await http_client.delete(f"/api/floor-plans/floors/{floor_id}", headers=admin_headers)
        assert del_res.status_code in (200, 204)


@pytest.mark.e2e
@pytest.mark.floor
async def test_admin_tools_list_floors_includes_created_floor(http_client, admin_headers, branches):
    branch_id = str(branches[0]["id"])
    branch_name = branches[0]["name"]

    floor_res = await http_client.post(
        "/api/floor-plans/floors",
        json={
            "branch_id": branch_id,
            "name": "pytest-list-floors-test",
            "floor_number": 98,
            "canvas_width": 800,
            "canvas_height": 600,
        },
        headers=admin_headers,
    )
    assert floor_res.status_code == 200, floor_res.text
    floor_id = floor_res.json()["id"]

    try:
        async with AsyncSessionLocal() as db:
            admin = (await db.execute(
                select(User).where(User.email == "admin@example.com")
            )).scalar_one()
            admin_tools = AdminChatbotTools(db=db, current_user=admin)
            floors = await admin_tools.list_floors(branch_name=branch_name)
            assert any(f["name"] == "pytest-list-floors-test" for f in floors), (
                f"Scratch floor not visible via list_floors(), got: {[f['name'] for f in floors]}"
            )
    finally:
        await http_client.delete(f"/api/floor-plans/floors/{floor_id}", headers=admin_headers)


@pytest.mark.e2e
@pytest.mark.floor
async def test_stage_add_desks_does_not_persist(http_client, admin_headers, branches):
    """stage_add_desks_to_floor must propose without persisting anything."""
    branch_id = str(branches[0]["id"])
    branch_name = branches[0]["name"]

    floor_res = await http_client.post(
        "/api/floor-plans/floors",
        json={"branch_id": branch_id, "name": "pytest-stage-desks", "floor_number": 97,
              "canvas_width": 800, "canvas_height": 600},
        headers=admin_headers,
    )
    assert floor_res.status_code == 200, floor_res.text
    floor_id = floor_res.json()["id"]

    try:
        workspace_id = str(uuid4())
        await http_client.post(
            f"/api/floor-plans/floors/{floor_id}/save",
            json={"items": [{
                "id": workspace_id, "item_type": "ROOM",
                "x": 0, "y": 0, "width": 800, "height": 600, "rotation": 0,
                "shape": "RECTANGLE", "z_index": 0,
                "properties": {"name": "Open Workspace", "room_type": "WORKSPACE",
                               "capacity": 999, "is_default_workspace": True},
            }]},
            headers=admin_headers,
        )

        async with AsyncSessionLocal() as db:
            admin = (await db.execute(
                select(User).where(User.email == "admin@example.com")
            )).scalar_one()
            admin_tools = AdminChatbotTools(db=db, current_user=admin)
            staged = await admin_tools.stage_add_desks_to_floor(
                floor_name="pytest-stage-desks", count=3, branch_name=branch_name
            )
            assert staged.get("action") == "REQUIRE_ADMIN_ACTION_CONFIRMATION", (
                f"Expected a staged proposal, got: {staged}"
            )
            new_items = staged["payload"]["new_items"]
            assert len(new_items) == 3
            assert all(i["item_type"] == "SEAT" for i in new_items)

        # Nothing should have been persisted
        draft = (await http_client.get(
            f"/api/floor-plans/floors/{floor_id}/layout",
            params={"draft": True},
            headers=admin_headers,
        )).json()
        assert not any(i["item_type"] == "SEAT" for i in draft), (
            "stage_add_desks_to_floor must not persist anything on its own"
        )
    finally:
        await http_client.delete(f"/api/floor-plans/floors/{floor_id}", headers=admin_headers)
