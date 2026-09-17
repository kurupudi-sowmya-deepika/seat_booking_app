"""Chatbot overhaul - standalone test script (no pytest, matching this repo's
convention). Run with the venv active from `backend/`:

    python tests/test_chatbot_split.py

Avoids real OpenRouter calls by monkeypatching `app.chatbot.service.get_model`
(the name bound in that module's own namespace) to return a
`FakeMessagesListChatModel` subclassed with a no-op `bind_tools()` - the same
pattern already established in test_ai_room_generation.py. Requires
`scripts/seed.py` to have been run first.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage

from app.main import app
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.chatbot.tools import ChatbotTools
from app.chatbot.admin_tools import AdminChatbotTools
import app.chatbot.service as chatbot_service


class FakeToolCallingModel(FakeMessagesListChatModel):
    """No-op bind_tools() so create_agent's tool-calling loop works against a
    scripted response sequence instead of a real API call."""
    def bind_tools(self, tools, **kwargs):
        return self


def install_fake_agent_model(tool_name: str, tool_args: dict, final_text: str):
    """First turn: the agent 'decides' to call `tool_name(**tool_args)`. Second
    turn (after the tool result is appended): the agent returns `final_text` with
    no further tool calls, ending the loop. Returns a restore function."""
    original = chatbot_service.get_model
    responses = [
        AIMessage(content="", tool_calls=[{"name": tool_name, "args": tool_args, "id": "call_1"}]),
        AIMessage(content=final_text),
    ]
    fake = FakeToolCallingModel(responses=responses)
    chatbot_service.get_model = lambda: fake
    return lambda: setattr(chatbot_service, "get_model", original)


async def run_unit_checks():
    print("\n[1] Testing ChatbotTools.open_booking_form() directly (no LLM)...")
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.email == "admin@example.com"))).scalar_one()
        tools = ChatbotTools(db=db, current_user=admin)

        result = await tools.open_booking_form(booking_type="MEETING_ROOM", attendees=6, booking_date="2026-09-12")
        assert result["action"] == "SHOW_BOOKING_FORM", f"Expected SHOW_BOOKING_FORM, got: {result}"
        assert result["payload"]["booking_type"] == "MEETING_ROOM"
        assert result["payload"]["attendees"] == 6
        assert result["payload"]["booking_date"] == "2026-09-12"
        assert "branch_id" not in result["payload"], "No branch given - branch_id must not be fabricated"
        print("[OK] open_booking_form returns a SHOW_BOOKING_FORM payload with only the known fields set.")

        result2 = await tools.open_booking_form(booking_type="CONFERENCE_ROOM", branch_name="Whitefield")
        if "branch_id" in result2["payload"]:
            assert result2["payload"]["branch_name"] and result2["payload"]["location_id"], "branch resolution must include name + location_id together"
            print("[OK] open_booking_form resolves a real branch_name to real branch_id/location_id.")
        else:
            print("[OK] open_booking_form leaves branch fields unset when no branch matches (no fabricated IDs).")

        print("\n[2] Testing AdminChatbotTools.list_rooms() directly (no LLM)...")
        admin_tools = AdminChatbotTools(db=db, current_user=admin)
        rooms = await admin_tools.list_rooms(room_type="MEETING_ROOM")
        assert isinstance(rooms, list)
        assert all(r["room_type"] == "MEETING_ROOM" for r in rooms), "list_rooms(room_type=...) must only return that type"
        print(f"[OK] AdminChatbotTools.list_rooms(room_type='MEETING_ROOM') returned {len(rooms)} real room(s), all correctly filtered.")


async def run_http_checks():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n[3] Authenticating as a regular user and as admin...")
        user_login = await client.post("/api/auth/login", data={"username": "user@example.com", "password": "user123"})
        assert user_login.status_code == 200, f"User login failed: {user_login.text}"
        user_headers = {"Authorization": f"Bearer {user_login.json()['access_token']}"}

        admin_login = await client.post("/api/auth/login", data={"username": "admin@example.com", "password": "admin123"})
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        print("\n[4] Testing POST /chatbot/message triggers SHOW_BOOKING_FORM (no sequential questions)...")
        restore = install_fake_agent_model(
            "open_booking_form",
            {"booking_type": "MEETING_ROOM", "booking_date": "2026-09-12", "attendees": 6, "start_time_str": "10:00"},
            "Sure - complete the booking details below.",
        )
        try:
            res = await client.post("/api/chatbot/message", json={"message": "Find a meeting room available tomorrow at 10 AM for 6 people."}, headers=user_headers)
        finally:
            restore()
        assert res.status_code == 200, f"Chat request failed: {res.text}"
        data = res.json()
        assert data["metadata"].get("action") == "SHOW_BOOKING_FORM", f"Expected SHOW_BOOKING_FORM, got: {data['metadata']}"
        assert data["metadata"]["payload"]["attendees"] == 6
        print("[OK] A booking-intent message immediately returns a SHOW_BOOKING_FORM action with pre-filled fields.")

        print("\n[5] Testing a non-admin is rejected by POST /chatbot/admin-message (backend enforcement)...")
        res = await client.post("/api/chatbot/admin-message", json={"message": "Show me all meeting rooms."}, headers=user_headers)
        assert res.status_code == 403, f"Expected 403 for a non-admin calling the admin route, got {res.status_code}: {res.text}"
        print("[OK] A normal user hitting the admin chatbot route is rejected with 403, before any admin tool runs.")

        print("\n[6] Testing an admin can use the Admin AI Assistant (list_rooms tool)...")
        restore = install_fake_agent_model("list_rooms", {"room_type": "MEETING_ROOM"}, "Here are all the meeting rooms.")
        try:
            res = await client.post("/api/chatbot/admin-message", json={"message": "Show me all meeting rooms."}, headers=admin_headers)
        finally:
            restore()
        assert res.status_code == 200, f"Admin chat request failed: {res.text}"
        assert "meeting rooms" in res.json()["message"].lower()
        print("[OK] An admin's request against the Admin AI Assistant runs the admin tool and returns a normal response.")


async def main():
    print("==================================================")
    print("   CHATBOT OVERHAUL TEST SUITE                    ")
    print("==================================================")
    await run_unit_checks()
    await run_http_checks()
    print("\n==================================================")
    print("   ALL CHATBOT OVERHAUL TESTS PASSED!             ")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
