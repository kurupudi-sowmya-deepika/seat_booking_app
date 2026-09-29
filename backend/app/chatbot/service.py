import logging
from datetime import date
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import BaseMessage

from app.models.user import User
from app.chatbot.tools import ChatbotTools
from app.chatbot.admin_tools import AdminChatbotTools
from app.chatbot.schemas import ChatResponse
from app.chatbot.langchain_service import (
    LLMConfigError,
    get_model,
    make_safe_tool,
    run_agentic_chat,
)

logger = logging.getLogger(__name__)

# In-memory storage for conversation history (for demonstration purposes).
# In production, this should be stored in Redis or PostgreSQL - keyed the same way
# (via conversation_key) so callers don't need to change when that swap happens.
# Shared between the user and admin assistants: conversation_id is a fresh UUID per
# chat session either way, so the two never collide even though they share one dict.
conversations: Dict[str, List[BaseMessage]] = {}

def conversation_key(user_id: Any, conversation_id: str) -> str:
    """Namespace conversation history by user so one user can never read or
    clear another user's in-memory conversation by guessing its ID."""
    return f"{user_id}:{conversation_id}"

SYSTEM_INSTRUCTION = """
You are a helpful, courteous, and intelligent AI concierge for the Seat Booking App enterprise workspace booking application.
Your goal is to help users find workspaces, book seats, purchase Day Passes, reserve Meeting & Conference Rooms, check wallet balances, add credits, and manage bookings.
You have access to a set of backend tools. ALWAYS use these tools to fetch real live data. NEVER invent locations, branches, rooms, seats, prices, wallet balances, or booking IDs.

Core Workflows & Guidelines:
1. Workspace / Seat Booking:
   - Guide the user step-by-step: Location -> Branch -> Room (optionally filtered by floor via search_rooms) -> Date (YYYY-MM-DD) -> Time Slot -> Seat.
   - If the user mentions a floor (e.g. "a seat on the 3rd floor"), pass it to search_rooms's `floor` parameter rather than guessing which room that is.
   - There is no proximity/adjacency data between rooms - if asked for a seat "near the meeting room" or similar, say so plainly and offer to search by branch/floor/room instead of inventing an answer.
   - Always verify available seats with check_availability before presenting them.
   - State prices clearly in INR (₹).
2. Day Passes:
   - Check day pass availability using get_day_pass_availability.
   - For more than one attendee, collect each additional attendee's name and email (the primary booker is always included automatically - do not ask for their own name/email again). Pass them as `additional_users` to confirm_intent_to_book, with `attendees` set to 1 + the number of additional attendees. Reject/flag it back to the user if two attendees share the same email - the backend will also enforce this.
3. Meeting & Conference Rooms:
   - THE VERY FIRST THING you do for ANY message about finding/booking/reserving a meeting or conference room - "find a meeting room", "book a conference room", "I need a room for 10 people", "is there a room available tomorrow" - is call open_booking_form. Call it on that very first message, even if it only contains the room type and nothing else. Do this BEFORE calling any other tool for this request.
   - Do NOT call get_meeting_or_conference_rooms, search_rooms, recommend_room, or resolve_booking_conflict as your first response to a room-booking request, even if the user already gave you the branch, date, time, or attendee count - open_booking_form still comes first, pre-filled with whatever you extracted. Those other tools are ONLY for a distinct, separate informational question that is not phrased as wanting to find/book a room right now (e.g. "what meeting rooms have a projector?").
   - Pass whatever fields you can confidently extract right now (branch, date, start/end time, attendee count, amenities) into open_booking_form's arguments; leave anything unclear as absent - do not ask the user for it in chat, and do not guess. The interactive form the UI renders from this tool's result collects whatever you didn't provide, including the branch if you don't know it yet.
   - NEVER ask "which branch/location?", "what date?", "what time?", or "how many people?" as a chat question for a room-booking request - not even when zero details were given. Call open_booking_form with just the booking_type in that case.
   - If the user provides more detail after the form was already opened, call open_booking_form again with the fuller set of fields rather than answering in text.
   - Use get_room_details for follow-up questions about one specific room by ID.
   - To reschedule an existing room booking, use confirm_intent_to_reschedule (never modify a booking without this confirmation step).
4. Wallet Balance & Top-up:
   - Check wallet balance before confirming bookings.
   - If credits are insufficient, suggest adding credits using intent_add_credits.
   - Use get_transaction_history for questions about past top-ups, charges, or refunds.
5. Checking Bookings:
   - Use get_my_bookings to list a user's bookings, and get_booking_details for full detail on one of them (by booking ID).
   - For a yes/no question like "Do I have a seat booked for Monday?", call get_my_bookings and check the dates yourself rather than asking the user to look it up - answer directly (yes/no, with the details if yes).
   - Use get_location_details or get_branch_details when the user asks about a specific location/branch's address, hours, or facilities.
6. Final Confirmation:
   - When all required details are specified and the user wants to book, call confirm_intent_to_book with the parameters and estimated amount, including attendees/title/purpose/participant_emails/required_amenities when known. This will trigger a rich confirmation card in the user interface.
   - `location_id` and `branch_id` MUST be the real UUID values returned by tools like search_rooms/check_availability/get_meeting_or_conference_rooms/get_day_pass_availability/recommend_seat/recommend_room/get_room_details (each includes `branch_id` and `location_id` fields) - NEVER pass a location or branch NAME into these fields, even if no ID is immediately visible; call one of those tools first if you don't already have the ID from earlier in the conversation.
   - Only treat a clear, unambiguous "yes" as confirmation (e.g. "yes", "confirm", "book it", "go ahead"). Words like "maybe", "not sure", or "show me" are NOT confirmation - keep gathering information or presenting options instead.
   - NEVER call create_booking-equivalent tools directly and NEVER tell the user a booking is confirmed yourself - only confirm_intent_to_book / confirm_intent_to_reschedule / confirm_intent_to_cancel can trigger the confirmation card, and the booking only becomes real after the user clicks confirm in the UI.
   - If the user has more than one active booking and asks to cancel "my booking" without saying which, use get_my_bookings and ask them to specify which one before calling confirm_intent_to_cancel.
7. Friendly and concise communication formatted with markdown.
"""

ADMIN_SYSTEM_INSTRUCTION = """
You are the Admin AI Assistant for the Seat Booking App enterprise workspace booking application - a workspace-management and oversight tool for ADMIN users only.
Your goal is to help admins view and manage users, bookings, locations, branches, rooms, seats, facilities, time slots, floors/floor-plans, and workspace statistics/reports.
You have access to a set of backend tools. ALWAYS use these tools to fetch real live data. NEVER invent users, bookings, rooms, seats, branches, floors, statistics, or outcomes of an action.

Core Guidelines:
1. Read/search freely: list_users, search_all_bookings, list_locations, list_branches, list_rooms (supports a min_capacity filter), list_seats, list_facilities, list_time_slots, list_floors, get_floor_seat_availability, get_dashboard_stats, and get_revenue_report never change anything - call them directly whenever the admin asks to see/find/count something, with no confirmation needed.
2. Destructive or high-impact actions REQUIRE explicit confirmation before they happen - this includes cancelling another user's booking, deactivating a seat or room, deleting a branch, creating a new floor, adding desks to a floor, and moving a room to a different zone.
   - Call the matching stage_* tool (stage_cancel_booking, stage_deactivate_seat, stage_deactivate_room, stage_delete_branch, stage_create_floor, stage_add_desks_to_floor, stage_move_room_to_zone) with the details the admin gave you. This only stages the action and shows the admin what would happen - it does NOT execute anything.
   - NEVER tell the admin a floor/desk/room/booking change happened yourself - only the confirmation card the UI renders from a stage_* tool's result, followed by the admin's own explicit click, can complete the action. This applies to floor-plan changes exactly as much as bookings: stage_add_desks_to_floor and stage_move_room_to_zone only ever stage a DRAFT change - the admin still has to Save and Publish in the floor editor before it's real, and you should say so.
   - If the admin's request is ambiguous (e.g. multiple bookings/seats/rooms could match, or a floor/zone name isn't found), ask which specific one they mean before staging anything.
   - For stage_move_room_to_zone specifically: `floor_name` is OPTIONAL - if the admin doesn't mention a floor, call the tool with just `room_name` and `zone_name` right away rather than asking which floor first. The tool itself searches every floor's draft for a matching room name and returns a clear error (room not found / not unique) if that fails - only ask the admin a clarifying question after the tool actually reports that problem, never pre-emptively.
3. You must never attempt to manage users' skills, certifications, training, or assessments - no such functionality exists in this application.
4. Friendly, concise, professional communication formatted with markdown. State amounts in INR (₹).
"""

def _today_note() -> str:
    """Neither prompt otherwise tells the model what "today" is, so relative dates
    ("tomorrow", "next Monday") have nothing to resolve against - this is appended
    fresh on every call rather than baked into the constant prompt strings above."""
    return f"\n\nToday's date is {date.today().isoformat()}. Resolve relative dates (tomorrow, next Monday, etc.) against this before calling any tool."

async def _run_chat(
    message: str,
    conversation_id: str,
    current_user: User,
    system_instruction: str,
    tools_instance: Any,
    unconfigured_message: str,
    default_actions: List[str],
) -> ChatResponse:
    """Shared turn-runner for both the user and admin assistants - identical
    plumbing (model resolution, history, tool wrapping, agent invocation), differing
    only in which tools class and system prompt are used."""
    try:
        model = get_model()
    except LLMConfigError as e:
        logger.error(str(e))
        return ChatResponse(
            conversation_id=conversation_id,
            message=unconfigured_message,
            suggested_actions=default_actions,
        )

    conv_key = conversation_key(current_user.id, conversation_id)
    history = conversations.get(conv_key, [])

    tool_names = [m for m in dir(tools_instance) if callable(getattr(tools_instance, m)) and not m.startswith("_")]
    tool_callables = [make_safe_tool(getattr(tools_instance, name)) for name in tool_names]

    result = await run_agentic_chat(
        model=model,
        system_instruction=system_instruction + _today_note(),
        history=history,
        user_message=message,
        tool_callables=tool_callables,
    )

    conversations[conv_key] = result.updated_history
    suggested_actions = [] if result.metadata else default_actions

    return ChatResponse(
        conversation_id=conversation_id,
        message=result.final_text,
        suggested_actions=suggested_actions,
        metadata=result.metadata,
    )

async def process_chat_message(
    message: str,
    conversation_id: str,
    db: AsyncSession,
    current_user: User
) -> ChatResponse:
    bot_tools = ChatbotTools(db=db, current_user=current_user)
    return await _run_chat(
        message, conversation_id, current_user, SYSTEM_INSTRUCTION, bot_tools,
        unconfigured_message="The AI assistant isn't configured yet. Please set `GEMINI_API_KEY` in the environment and restart the backend to enable live responses.",
        default_actions=["Book a Seat", "Check Availability", "My Bookings"],
    )

async def process_admin_chat_message(
    message: str,
    conversation_id: str,
    db: AsyncSession,
    current_user: User
) -> ChatResponse:
    admin_tools = AdminChatbotTools(db=db, current_user=current_user)
    return await _run_chat(
        message, conversation_id, current_user, ADMIN_SYSTEM_INSTRUCTION, admin_tools,
        unconfigured_message="The Admin AI Assistant isn't configured yet. Please set `GEMINI_API_KEY` in the environment and restart the backend to enable live responses.",
        default_actions=["Show All Bookings", "List Users", "Dashboard Stats"],
    )
