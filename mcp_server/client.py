import httpx
from typing import Dict, Any, List, Optional
from mcp_server.config import settings

class SeatBookingAPIClient:
    """Async HTTP client to communicate with the Seat Booking FastAPI backend."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.SEAT_BOOKING_API_URL).rstrip("/")
        self._tokens: Dict[str, str] = {}
        if settings.SEAT_BOOKING_AUTH_TOKEN:
            self._tokens["default"] = settings.SEAT_BOOKING_AUTH_TOKEN

    async def login(self, email: str, password: str) -> str:
        """Authenticate a real employee with their own email + password against
        the standard /auth/login endpoint (the same one the web app itself uses)
        and cache the resulting JWT under their email. This is the ONLY
        authentication path - the previous approach of POSTing a fabricated
        payload to /auth/login/entra worked only because that endpoint didn't
        verify a real Microsoft signature; now that it does (see backend
        app/api/routes/auth.py), a made-up token is correctly rejected, and a
        real password is required here instead."""
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.post(
                f"{self.base_url}/auth/login",
                data={"username": email, "password": password},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code != 200:
            detail = resp.text
            try:
                detail = resp.json().get("detail", detail)
            except Exception:
                pass
            raise RuntimeError(f"Authentication failed for '{email}': {detail}")

        token = resp.json().get("access_token")
        if not token:
            raise RuntimeError(f"Authentication succeeded for '{email}' but no access_token was returned.")
        self._tokens[email] = token
        return token

    async def _get_auth_token(self, employee_email: Optional[str] = None, auth_token: Optional[str] = None) -> str:
        """Resolve the bearer token for a tool call. Prefers an explicit
        `auth_token` (from a prior `authenticate_employee` call), then an
        already-cached token for `employee_email`. Falls back to one shared
        default-service identity ONLY when MCP_ALLOW_DEFAULT_IDENTITY is
        enabled - see config.py - so production deployments can't silently act
        as a single shared account when a caller forgets to authenticate."""
        if auth_token:
            return auth_token

        if employee_email and employee_email in self._tokens:
            return self._tokens[employee_email]

        if not employee_email:
            if "default" in self._tokens:
                return self._tokens["default"]
            if settings.MCP_ALLOW_DEFAULT_IDENTITY and settings.SEAT_BOOKING_USER_EMAIL and settings.SEAT_BOOKING_USER_PASSWORD:
                token = await self.login(settings.SEAT_BOOKING_USER_EMAIL, settings.SEAT_BOOKING_USER_PASSWORD)
                self._tokens["default"] = token
                return token

        raise RuntimeError(
            "No employee identity to act as. Call `authenticate_employee` first with the "
            "employee's real email and password, and pass the returned token as `auth_token` "
            "(or `employee_email`, if already authenticated this session) on this call."
        )

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None,
        requires_auth: bool = True
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers: Dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": "SeatBooking-MCP-Server/1.0"
        }

        if requires_auth:
            token = await self._get_auth_token(employee_email=employee_email, auth_token=auth_token)
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=headers
            )

            # If token expired (401), clear cache and retry once
            if resp.status_code == 401 and requires_auth and not auth_token:
                email = employee_email or settings.SEAT_BOOKING_USER_EMAIL
                self._tokens.pop(email, None)
                self._tokens.pop("default", None)
                token = await self._get_auth_token(employee_email=employee_email)
                headers["Authorization"] = f"Bearer {token}"
                resp = await client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data,
                    headers=headers
                )

            if resp.status_code >= 400:
                detail = resp.text
                try:
                    error_json = resp.json()
                    detail = error_json.get("detail", str(error_json))
                except Exception:
                    pass
                raise RuntimeError(f"Seat Booking API Error ({resp.status_code}): {detail}")

            if resp.status_code == 204 or not resp.content:
                return {"status": "success"}

            return resp.json()

    # User Portal API Functions
    async def get_locations(self) -> List[Dict[str, Any]]:
        """Retrieve all active corporate locations (Jacksonville, McLean, London, Bangalore, Hyderabad, etc.)."""
        return await self._request("GET", "/locations/", requires_auth=False)

    async def get_branches(self, location_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve campus branches and offices, optionally filtered by location_id."""
        params = {}
        if location_id:
            params["location_id"] = location_id
        return await self._request("GET", "/branches/", params=params, requires_auth=False)

    async def get_rooms(self, branch_id: Optional[str] = None, room_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve rooms/zones within a campus branch, optionally filtered by room_type ('WORKSPACE', 'MEETING_ROOM', 'CONFERENCE_ROOM')."""
        params = {}
        if branch_id:
            params["branch_id"] = branch_id
        if room_type:
            params["room_type"] = room_type
        return await self._request("GET", "/rooms/", params=params, requires_auth=False)

    async def get_time_slots(self) -> List[Dict[str, Any]]:
        """Retrieve active time slot definitions configured in the system."""
        return await self._request("GET", "/time-slots/", requires_auth=False)

    async def check_seat_availability(self, room_id: str, booking_date: str, time_slot_id: str) -> List[Dict[str, Any]]:
        """Check seat availability for a room on a given date and time slot."""
        params = {
            "room_id": room_id,
            "booking_date": booking_date,
            "time_slot_id": time_slot_id
        }
        # Public on the backend, like every other /bookings/availability/* read.
        return await self._request("GET", "/bookings/availability/seat", params=params, requires_auth=False)

    async def check_room_availability(
        self,
        branch_id: str,
        booking_date: str,
        start_time: str,
        end_time: str,
        room_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Check smart meeting room or conference hall availability for a time window."""
        params = {
            "branch_id": branch_id,
            "booking_date": booking_date,
            "start_time": start_time if len(start_time) == 8 else f"{start_time}:00",
            "end_time": end_time if len(end_time) == 8 else f"{end_time}:00"
        }
        rooms = await self._request("GET", "/bookings/availability/room", params=params, requires_auth=False)
        if room_type:
            rooms = [r for r in rooms if r.get("room_type") == room_type]
        return rooms

    async def book_seat(
        self,
        location_id: str,
        branch_id: str,
        room_id: str,
        seat_id: str,
        booking_date: str,
        time_slot_id: str,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Book a single workstation for an employee."""
        payload = {
            "booking_type": "SEAT",
            "location_id": location_id,
            "branch_id": branch_id,
            "room_id": room_id,
            "seat_id": seat_id,
            "booking_date": booking_date,
            "time_slot_id": time_slot_id
        }
        return await self._request("POST", "/bookings/", json_data=payload, employee_email=employee_email, auth_token=auth_token)

    async def book_meeting_room(
        self,
        location_id: str,
        branch_id: str,
        room_id: str,
        booking_date: str,
        start_time: str,
        end_time: str,
        title: Optional[str] = None,
        purpose: Optional[str] = None,
        participant_emails: Optional[List[str]] = None,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Book a smart meeting room or conference hall."""
        payload = {
            "booking_type": "MEETING_ROOM",
            "location_id": location_id,
            "branch_id": branch_id,
            "room_id": room_id,
            "booking_date": booking_date,
            "start_time": start_time if len(start_time) == 8 else f"{start_time}:00",
            "end_time": end_time if len(end_time) == 8 else f"{end_time}:00",
            "title": title or "Team Collaboration Session",
            "purpose": purpose or "Workplace Meeting",
            "participant_emails": participant_emails or []
        }
        return await self._request("POST", "/bookings/", json_data=payload, employee_email=employee_email, auth_token=auth_token)

    async def get_my_bookings(self, employee_email: Optional[str] = None, auth_token: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve booking history for the requesting employee."""
        return await self._request("GET", "/bookings/my", employee_email=employee_email, auth_token=auth_token)

    async def cancel_booking(
        self,
        booking_id: str,
        reason: Optional[str] = None,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cancel an existing booking and trigger wallet refund if applicable."""
        payload = {"reason": reason or "Cancelled via AI Assistant"}
        return await self._request("POST", f"/bookings/{booking_id}/cancel", json_data=payload, employee_email=employee_email, auth_token=auth_token)

    async def get_day_passes(self, branch_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve active day pass packages, optionally filtered by branch."""
        params = {}
        if branch_id:
            params["branch_id"] = branch_id
        return await self._request("GET", "/day-passes/", params=params, requires_auth=False)

    async def check_day_pass_availability(self, branch_id: str, booking_date: str) -> List[Dict[str, Any]]:
        """Check availability of day passes for a campus on a specific date."""
        params = {
            "branch_id": branch_id,
            "booking_date": booking_date
        }
        return await self._request("GET", "/bookings/availability/day-pass", params=params, requires_auth=False)

    async def book_day_pass(
        self,
        location_id: str,
        branch_id: str,
        day_pass_id: str,
        booking_date: str,
        number_of_people: int = 1,
        additional_users: Optional[List[Dict[str, str]]] = None,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Book a full-day flex pass for one or multiple people."""
        payload = {
            "booking_type": "DAY_PASS",
            "location_id": location_id,
            "branch_id": branch_id,
            "day_pass_id": day_pass_id,
            "booking_date": booking_date,
            "number_of_people": number_of_people,
            "additional_users": additional_users or []
        }
        return await self._request("POST", "/bookings/", json_data=payload, employee_email=employee_email, auth_token=auth_token)

    async def pre_register_visitor(
        self,
        branch_id: str,
        visitor_name: str,
        visitor_email: str,
        visitor_phone: Optional[str] = None,
        purpose: Optional[str] = "Client Meeting & Discussion",
        visit_date: Optional[str] = None,
        expected_arrival_time: Optional[str] = "10:00:00",
        notes: Optional[str] = None,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Pre-register an external guest and issue a visitor pass."""
        payload = {
            "branch_id": branch_id,
            "visitor_name": visitor_name,
            "visitor_email": visitor_email,
            "visitor_phone": visitor_phone,
            "purpose": purpose or "Workplace Meeting",
            "visit_date": visit_date,
            "expected_arrival_time": expected_arrival_time if len(expected_arrival_time or "") == 8 else f"{expected_arrival_time or '10:00'}:00",
            "notes": notes
        }
        return await self._request("POST", "/visitors/", json_data=payload, employee_email=employee_email, auth_token=auth_token)

    async def get_my_visitors(
        self,
        status: Optional[str] = None,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve visitor passes hosted by the employee."""
        params = {}
        if status:
            params["status"] = status
        return await self._request("GET", "/visitors/", params=params, employee_email=employee_email, auth_token=auth_token)

    async def check_in_visitor(
        self,
        visitor_id: str,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mark a visitor as checked in at the reception desk."""
        return await self._request("POST", f"/visitors/{visitor_id}/check-in", employee_email=employee_email, auth_token=auth_token)

    async def check_out_visitor(
        self,
        visitor_id: str,
        employee_email: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mark a visitor as checked out."""
        return await self._request("POST", f"/visitors/{visitor_id}/check-out", employee_email=employee_email, auth_token=auth_token)

    async def get_wallet_balance(self, employee_email: Optional[str] = None, auth_token: Optional[str] = None) -> Dict[str, Any]:
        """Retrieve the prepaid wallet balance for the employee."""
        return await self._request("GET", "/wallet/", employee_email=employee_email, auth_token=auth_token)

api_client = SeatBookingAPIClient()
