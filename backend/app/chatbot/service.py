import logging
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.chatbot.tools import ChatbotTools
from app.chatbot.schemas import ChatResponse
from app.chatbot.openai_service import (
    OpenAIConfigError,
    build_tool_schema,
    get_client,
    run_agentic_chat,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory storage for conversation history (for demonstration purposes).
# In production, this should be stored in Redis or PostgreSQL - keyed the same way
# (via conversation_key) so callers don't need to change when that swap happens.
conversations: Dict[str, List[Any]] = {}

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
   - Guide the user step-by-step: Location -> Branch -> Room -> Date (YYYY-MM-DD) -> Time Slot -> Seat.
   - Always verify available seats with check_availability before presenting them.
   - State prices clearly in INR (₹).
2. Day Passes:
   - Check day pass availability using get_day_pass_availability.
   - For more than one attendee, collect each additional attendee's name and email (the primary booker is always included automatically - do not ask for their own name/email again). Pass them as `additional_users` to confirm_intent_to_book, with `attendees` set to 1 + the number of additional attendees. Reject/flag it back to the user if two attendees share the same email - the backend will also enforce this.
3. Meeting & Conference Rooms:
   - Required fields before searching: booking type (meeting or conference room), date, start time, end time (or duration), and number of attendees. Amenities (Projector, Video Conferencing, Whiteboard, Display, Wi-Fi, AC, etc.), meeting title, purpose, and participant emails are optional.
   - NEVER ask for a field the user already gave you in this conversation, and NEVER assume or invent a missing date, time, or attendee count - ask for exactly what's missing.
   - Query rooms with get_meeting_or_conference_rooms, always passing `capacity` (attendee count) and `amenities` when known - it deterministically filters out rooms that don't fit or lack the amenity, so trust its `available_rooms` list exactly as returned; never suggest a room it did not return.
   - Use get_room_details for follow-up questions about one specific room.
   - If `available_rooms` is empty, call resolve_booking_conflict with the same parameters and offer the real alternatives it returns (nearby time slots, larger rooms, rooms without the amenity, or the next day). Do not book an alternative automatically - always ask which one the user wants, if any.
   - To reschedule an existing room booking, use reschedule via confirm_intent_to_reschedule (never modify a booking without this confirmation step).
4. Wallet Balance & Top-up:
   - Check wallet balance before confirming bookings.
   - If credits are insufficient, suggest adding credits using intent_add_credits.
   - Use get_transaction_history for questions about past top-ups, charges, or refunds.
5. Checking Bookings:
   - Use get_my_bookings to list a user's bookings, and get_booking_details for full detail on one of them (by booking ID).
   - Use get_location_details or get_branch_details when the user asks about a specific location/branch's address, hours, or facilities.
6. Final Confirmation:
   - When all required details are specified and the user wants to book, call confirm_intent_to_book with the parameters and estimated amount, including attendees/title/purpose/participant_emails/required_amenities when known. This will trigger a rich confirmation card in the user interface.
   - Only treat a clear, unambiguous "yes" as confirmation (e.g. "yes", "confirm", "book it", "go ahead"). Words like "maybe", "not sure", or "show me" are NOT confirmation - keep gathering information or presenting options instead.
   - NEVER call create_booking-equivalent tools directly and NEVER tell the user a booking is confirmed yourself - only confirm_intent_to_book / confirm_intent_to_reschedule / confirm_intent_to_cancel can trigger the confirmation card, and the booking only becomes real after the user clicks confirm in the UI.
   - If the user has more than one active booking and asks to cancel "my booking" without saying which, use get_my_bookings and ask them to specify which one before calling confirm_intent_to_cancel.
7. Friendly and concise communication formatted with markdown.
"""

async def process_chat_message(
    message: str,
    conversation_id: str,
    db: AsyncSession,
    current_user: User
) -> ChatResponse:

    try:
        client = get_client()
    except OpenAIConfigError as e:
        logger.error(str(e))
        return ChatResponse(
            conversation_id=conversation_id,
            message="The AI assistant isn't configured yet. Please set `OPENAI_API_KEY` in the environment and restart the backend to enable live responses.",
            suggested_actions=["Book a Seat", "Day Pass", "Meeting Rooms", "My Wallet"]
        )

    # Retrieve or create conversation history, namespaced by user
    conv_key = conversation_key(current_user.id, conversation_id)
    history = conversations.get(conv_key, [])

    # Instantiate the tools class so methods are bound to db and current_user
    bot_tools = ChatbotTools(db=db, current_user=current_user)
    tool_names = [m for m in dir(bot_tools) if callable(getattr(bot_tools, m)) and not m.startswith("_")]
    tool_callables = {name: getattr(bot_tools, name) for name in tool_names}
    tool_schemas = [build_tool_schema(func) for func in tool_callables.values()]

    result = await run_agentic_chat(
        client=client,
        model=settings.OPENAI_MODEL,
        system_instruction=SYSTEM_INSTRUCTION,
        history=history,
        user_message=message,
        tool_callables=tool_callables,
        tool_schemas=tool_schemas,
    )

    # Save updated history for the next turn in this conversation
    conversations[conv_key] = result.updated_history

    # Generate basic suggested actions if no explicit booking/cancel/reschedule intent
    suggested_actions = [] if result.metadata else ["Book a Seat", "Check Availability", "My Bookings"]

    return ChatResponse(
        conversation_id=conversation_id,
        message=result.final_text,
        suggested_actions=suggested_actions,
        metadata=result.metadata
    )
