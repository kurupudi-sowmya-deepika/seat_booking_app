import os
import json
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types

from app.models.user import User
from app.chatbot.tools import ChatbotTools
from app.chatbot.schemas import ChatResponse
from app.core.config import settings

# In-memory storage for conversation history (for demonstration purposes).
# In production, this should be stored in Redis or PostgreSQL.
conversations: Dict[str, List[types.Content]] = {}

SYSTEM_INSTRUCTION = """
You are a helpful and intelligent AI assistant for the SeatSync workspace booking application.
Your goal is to help users find available workspaces, book seats, check their wallet balance, add credits, and manage their bookings.
You have access to a set of tools to query the database. ALWAYS use these tools to get real data. NEVER invent locations, rooms, seats, prices, or booking IDs.

Rules:
1. When a user wants to book a seat, ask clarifying questions one by one (Location -> Branch -> Room -> Date -> Time -> Seat) if they don't provide all info.
2. ALWAYS use check_availability to verify seats before offering them to the user.
3. Before booking, check their wallet balance. If it's insufficient, ask them to add credits using the intent_add_credits tool.
4. When all info is collected and the user is ready to book, ALWAYS call confirm_intent_to_book. This signals the UI to show the final confirmation modal. DO NOT say the booking is complete until after they confirm in the UI.
5. If the user wants to add credits, call intent_add_credits.
6. Keep your responses concise and friendly. Format data nicely with markdown.
"""

async def process_chat_message(
    message: str, 
    conversation_id: str, 
    db: AsyncSession, 
    current_user: User
) -> ChatResponse:
    
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return ChatResponse(
            conversation_id=conversation_id,
            message="Chatbot is currently disabled. Please configure GEMINI_API_KEY.",
            suggested_actions=[]
        )

    client = genai.Client(api_key=api_key)
    
    # Initialize tools
    chatbot_tools = ChatbotTools(db, current_user)
    
    # Define the functions we are passing to the model
    # We will pass the actual callables to let the SDK schema-fy them.
    tools_list = [
        chatbot_tools.search_locations,
        chatbot_tools.search_branches,
        chatbot_tools.search_rooms,
        chatbot_tools.get_time_slots,
        chatbot_tools.check_availability,
        chatbot_tools.get_wallet_balance,
        chatbot_tools.get_my_bookings,
        chatbot_tools.confirm_intent_to_book,
        chatbot_tools.confirm_intent_to_cancel,
        chatbot_tools.intent_add_credits
    ]

    # Retrieve or create conversation history
    if conversation_id not in conversations:
        conversations[conversation_id] = []
        
    history = conversations[conversation_id]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        tools=tools_list,
    )

    # Note: For complex async tools, we use manual tool dispatch loop.
    # The SDK handles serialization, but we want full control over the response to capture intents.
    chat = client.aio.chats.create(
        model="gemini-2.5-flash",
        config=config,
        history=history
    )
    
    response = await chat.send_message(message)
    
    # The SDK automatically handles calling the Python functions and sending the results back 
    # if we passed them in `tools` and they are synchronous. However, since ours are `async def`, 
    # we might need to handle FunctionCalls manually if the SDK doesn't natively `await` them.
    # Fortunately, the google-genai async client (`client.aio`) handles `async` tools automatically 
    # if provided. The final response will be the text after all tool calls are resolved.
    
    final_text = response.text
    suggested_actions = []
    metadata = {}
    
    # Inspect the history to see if an intent tool was called and returned its payload.
    # The SDK appends the tool responses to `chat.get_history()`.
    for content in reversed(await chat.get_history()):
        if content.parts:
            for part in content.parts:
                if part.function_response:
                    try:
                        # Extract the dictionary we returned from our intent tools
                        resp_dict = part.function_response.response
                        if isinstance(resp_dict, dict) and "action" in resp_dict:
                            metadata["action"] = resp_dict["action"]
                            metadata["payload"] = resp_dict.get("payload", {})
                    except Exception as e:
                        pass
        
        # Stop searching if we hit a user message
        if content.role == "user":
            break

    # Save updated history
    conversations[conversation_id] = await chat.get_history()

    # Generate basic suggested actions if no explicit intent
    if not metadata:
        suggested_actions = ["Book a Seat", "Check Availability", "My Bookings"]

    return ChatResponse(
        conversation_id=conversation_id,
        message=final_text or "I'm not sure how to help with that.",
        suggested_actions=suggested_actions,
        metadata=metadata
    )
