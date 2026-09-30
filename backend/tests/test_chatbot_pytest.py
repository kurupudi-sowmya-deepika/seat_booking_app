"""
test_chatbot_pytest.py – chatbot / AI tests (pytest version).

Avoids real Gemini API calls by monkeypatching `app.chatbot.service.get_model`
with a FakeToolCallingModel (same technique as test_chatbot_split.py).

Covers:
  • ChatbotTools.open_booking_form()  directly (no HTTP, no LLM)
  • AdminChatbotTools.list_rooms()    directly
  • POST /chatbot/message             → SHOW_BOOKING_FORM action via fake LLM
  • POST /chatbot/admin-message       → 403 for non-admin
  • POST /chatbot/admin-message       → 200 for admin with fake LLM
"""
from __future__ import annotations

import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage
from sqlalchemy import select

import app.chatbot.service as chatbot_service
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.chatbot.tools import ChatbotTools
from app.chatbot.admin_tools import AdminChatbotTools


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

class FakeToolCallingModel(FakeMessagesListChatModel):
    """No-op bind_tools() so the agent loop works with scripted responses."""
    def bind_tools(self, tools, **kwargs):
        return self


def _install_fake_agent(tool_name: str, tool_args: dict, final_text: str):
    """Patches get_model; returns a restore callable."""
    original = chatbot_service.get_model
    responses = [
        AIMessage(content="", tool_calls=[{"name": tool_name, "args": tool_args, "id": "call_1"}]),
        AIMessage(content=final_text),
    ]
    chatbot_service.get_model = lambda: FakeToolCallingModel(responses=responses)
    return lambda: setattr(chatbot_service, "get_model", original)


# ──────────────────────────────────────────────────────────────────────────
# Direct tool tests (no LLM, no HTTP)
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.chatbot
async def test_open_booking_form_returns_show_booking_form_action():
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(
            select(User).where(User.email == "admin@example.com")
        )).scalar_one()
        tools = ChatbotTools(db=db, current_user=admin)

        result = await tools.open_booking_form(
            booking_type="MEETING_ROOM", attendees=6, booking_date="2026-09-12"
        )
        assert result["action"] == "SHOW_BOOKING_FORM"
        assert result["payload"]["booking_type"] == "MEETING_ROOM"
        assert result["payload"]["attendees"] == 6
        assert "branch_id" not in result["payload"], (
            "branch_id must not be fabricated when no branch was supplied"
        )


@pytest.mark.e2e
@pytest.mark.chatbot
async def test_admin_tools_list_rooms_filters_by_type():
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(
            select(User).where(User.email == "admin@example.com")
        )).scalar_one()
        admin_tools = AdminChatbotTools(db=db, current_user=admin)
        rooms = await admin_tools.list_rooms(room_type="MEETING_ROOM")
        assert isinstance(rooms, list)
        for r in rooms:
            assert r["room_type"] == "MEETING_ROOM", (
                f"list_rooms(room_type='MEETING_ROOM') returned a non-meeting-room: {r}"
            )


# ──────────────────────────────────────────────────────────────────────────
# HTTP endpoint tests (with fake LLM)
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.chatbot
async def test_chatbot_message_returns_show_booking_form(http_client, user_headers):
    restore = _install_fake_agent(
        "open_booking_form",
        {"booking_type": "MEETING_ROOM", "booking_date": "2026-09-12", "attendees": 6, "start_time_str": "10:00"},
        "Sure – complete the booking details below.",
    )
    try:
        res = await http_client.post(
            "/api/chatbot/message",
            json={"message": "Find a meeting room available tomorrow at 10 AM for 6 people."},
            headers=user_headers,
        )
    finally:
        restore()

    assert res.status_code == 200, f"Chatbot request failed: {res.text}"
    data = res.json()
    assert data["metadata"].get("action") == "SHOW_BOOKING_FORM", (
        f"Expected SHOW_BOOKING_FORM, got: {data['metadata']}"
    )
    assert data["metadata"]["payload"]["attendees"] == 6


@pytest.mark.e2e
@pytest.mark.chatbot
async def test_admin_chatbot_rejects_non_admin(http_client, user_headers):
    res = await http_client.post(
        "/api/chatbot/admin-message",
        json={"message": "Show me all meeting rooms."},
        headers=user_headers,
    )
    assert res.status_code == 403, (
        f"Expected 403 for non-admin on admin chatbot route, got {res.status_code}"
    )


@pytest.mark.e2e
@pytest.mark.chatbot
async def test_admin_chatbot_accessible_by_admin(http_client, admin_headers):
    restore = _install_fake_agent("list_rooms", {"room_type": "MEETING_ROOM"}, "Here are all the meeting rooms.")
    try:
        res = await http_client.post(
            "/api/chatbot/admin-message",
            json={"message": "Show me all meeting rooms."},
            headers=admin_headers,
        )
    finally:
        restore()

    assert res.status_code == 200, f"Admin chatbot request failed: {res.text}"
    assert "meeting rooms" in res.json()["message"].lower()
