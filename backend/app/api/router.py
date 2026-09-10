from fastapi import APIRouter
from app.api.routes import (
    auth, locations, branches, rooms, facilities, seats, 
    day_passes, time_slots, bookings, payments, wallet, users, 
    admin, chatbot, visitors, notifications, reports
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(branches.router, prefix="/branches", tags=["branches"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
api_router.include_router(facilities.router, prefix="/facilities", tags=["facilities"])
api_router.include_router(seats.router, prefix="/seats", tags=["seats"])
api_router.include_router(day_passes.router, prefix="/day-passes", tags=["day-passes"])
api_router.include_router(time_slots.router, prefix="/time-slots", tags=["time-slots"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(wallet.router, prefix="/wallet", tags=["wallet"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(chatbot.router, prefix="/chatbot", tags=["chatbot"])
api_router.include_router(visitors.router, prefix="/visitors", tags=["visitors"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
