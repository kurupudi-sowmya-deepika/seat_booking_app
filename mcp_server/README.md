# 🔌 Seat Booking MCP Server

The **Seat Booking MCP Server** exposes the user-portal capabilities of the Seat Booking application to external AI agents (e.g., **WorkPilot**, **Intuceo.Ai**, **Claude Desktop**, and **Antigravity**) via the standardized [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

---

## 🌟 Features & Exposed Tools

| MCP Tool | Description |
| :--- | :--- |
| `get_locations` | Lists active global hubs (Jacksonville, McLean, London, Bangalore, Hyderabad) |
| `get_branches` | Retrieves campus branches and offices for a given location |
| `get_floors_and_rooms` | Retrieves floors, workspaces, meeting rooms, and conference halls |
| `get_time_slots` | Fetches active corporate time slots |
| `check_seat_availability` | Checks available & occupied desks for a room, date, and time slot |
| `search_available_seats` | Searches and filters available desks across campus locations |
| `book_seat` | Reserves a workstation, debits wallet balance, and creates database record |
| `get_my_bookings` | Retrieves all active, upcoming, and past reservations for an employee |
| `cancel_my_booking` | Cancels a booking and automatically processes eligible refunds |
| `check_meeting_room_availability` | Checks availability for smart meeting rooms & conference halls |
| `book_meeting_room` | Reserves a meeting room or conference hall |
| `get_day_passes` | Retrieves Day Pass packages and included amenities |
| `check_day_pass_availability` | Checks day pass availability and capacity for a campus |
| `book_day_pass` | Books a full-day flex pass for individual or multi-user groups |
| `pre_register_visitor` | Pre-registers external guests and issues digital visitor passes |
| `get_my_visitors` | Retrieves active and past guest passes hosted by an employee |
| `check_in_visitor` | Marks a visitor as checked-in on-site at the reception desk |
| `check_out_visitor` | Marks a visitor as checked-out upon departure |
| `get_my_wallet_balance` | Retrieves current prepaid wallet credits |

---

## ⚙️ Configuration & Environment Variables

The MCP server connects to the running FastAPI application over HTTP.

Configure the following environment variables in `.env` or in your MCP client configuration:

```env
# URL of the running Seat Booking backend
SEAT_BOOKING_API_URL=http://localhost:8000/api

# Employee identity for automated authentication
SEAT_BOOKING_USER_EMAIL=sdkurupudi@intuceo.com
SEAT_BOOKING_USER_PASSWORD=user123

# (Optional) Pre-generated JWT Bearer Token
SEAT_BOOKING_AUTH_TOKEN=
```

---

## 🚀 Connection Setup for External AI Agents

### 1. Claude Desktop Configuration
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seat-booking": {
      "command": "python",
      "args": [
        "-m",
        "mcp_server.server"
      ],
      "cwd": "d:/intuceo_projects/seat_booking_app",
      "env": {
        "SEAT_BOOKING_API_URL": "http://localhost:8000/api",
        "SEAT_BOOKING_USER_EMAIL": "sdkurupudi@intuceo.com",
        "SEAT_BOOKING_USER_PASSWORD": "user123"
      }
    }
  }
}
```

### 2. WorkPilot / Intuceo.Ai Configuration
Register the MCP server in your WorkPilot or Intuceo.Ai agent manifest:

```json
{
  "name": "SeatBookingIntegration",
  "type": "stdio",
  "command": "python",
  "args": ["-m", "mcp_server.server"],
  "cwd": "d:/intuceo_projects/seat_booking_app",
  "env": {
    "SEAT_BOOKING_API_URL": "http://localhost:8000/api",
    "SEAT_BOOKING_USER_EMAIL": "sdkurupudi@intuceo.com"
  }
}
```

---

## 🧪 Testing the MCP Server

You can run the MCP server directly to test tool discovery:

```bash
# In the repository root:
python -m mcp_server.server
```
