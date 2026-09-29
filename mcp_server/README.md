# 🔌 Seat Booking MCP Server

The **Seat Booking MCP Server** exposes the user-portal capabilities of the Seat Booking application to external AI agents (e.g., **WorkPilot**, **Intuceo.Ai**, **Claude Desktop**, and **Antigravity**) via the standardized [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

---

## 🌟 Features & Exposed Tools

| MCP Tool | Description |
| :--- | :--- |
| `authenticate_employee` | Authenticates a real employee (email + password) and returns their `auth_token` - call this first |
| `get_current_user` | Returns the acting employee's id, name, email and role (confirms whose identity is in use) |
| `get_users` | Searches active colleagues by name/email (id, name, email only; min 2 chars, max 10 results) |
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

## 🔐 Authentication model

Every tool that touches an employee's own data (bookings, wallet, visitors) needs
a real per-employee identity - there is no default account baked into the code.
Call `authenticate_employee(email, password)` first; it returns an `auth_token`
you then pass to every subsequent tool call for that employee.

A single shared "default identity" fallback exists purely for local testing
convenience (so you don't have to pass a token on every call while developing) -
it is **disabled by default** and must be explicitly opted into with
`MCP_ALLOW_DEFAULT_IDENTITY=true` plus real `SEAT_BOOKING_USER_EMAIL`/
`SEAT_BOOKING_USER_PASSWORD` values in your own local environment. Never enable
it, and never commit real credentials to this repo's tracked config files.

### Trusted-caller mode (used by WorkPilot)

An application such as WorkPilot already knows who its signed-in employee is but does not hold their
Seat Booking password. For that case the MCP server and the Seat API support a *trusted caller*:

```
client --(Authorization: Bearer MCP_AUTH_TOKEN, tool arg employee_email)--> MCP server
MCP server --(X-Service-Token: WORKPILOT_SERVICE_TOKEN, X-On-Behalf-Of-Email)--> Seat API
```

- The Seat API then acts as that **existing, active** user with exactly that user's own role. It never
  creates accounts and never elevates a role; unknown or inactive emails get 401. It is disabled unless
  `WORKPILOT_SERVICE_TOKEN` is set.
- Because a caller can name any employee, the streamable-http endpoint **must** be protected: set
  `MCP_AUTH_TOKEN`. The server refuses to start if `WORKPILOT_SERVICE_TOKEN` is set without it. Keep the
  port on an internal network and store both tokens in a secret manager.
- Only pass `employee_email` from a trusted backend that took it from its own authenticated session.
- Regression test for the Seat API side: `backend/tests/test_service_token_auth.py <existing-user-email>`
  (read-only).

## ⚙️ Configuration & Environment Variables

The MCP server connects to the running FastAPI application over HTTP.

Configure the following environment variables in `.env` (not committed) or in
your MCP client configuration:

```env
# URL of the running Seat Booking backend
SEAT_BOOKING_API_URL=http://localhost:8000/api

# Transport: "stdio" (default, for a locally-spawned client like Claude
# Desktop) or "streamable-http" (a standalone network service another
# application connects to over HTTP).
MCP_TRANSPORT=stdio
MCP_HOST=0.0.0.0
MCP_PORT=8100

# Local-testing-only shared identity - see "Authentication model" above.
# Leave MCP_ALLOW_DEFAULT_IDENTITY unset/false in any shared or production environment.
MCP_ALLOW_DEFAULT_IDENTITY=false

# Bearer token every client must send over streamable-http (required with WORKPILOT_SERVICE_TOKEN).
MCP_AUTH_TOKEN=
# Shared with the Seat API (same variable name there). Enables trusted-caller mode.
WORKPILOT_SERVICE_TOKEN=
SEAT_BOOKING_USER_EMAIL=
SEAT_BOOKING_USER_PASSWORD=

# (Optional) Pre-generated JWT Bearer Token, used the same way as an auth_token
SEAT_BOOKING_AUTH_TOKEN=
```

---

## 🚀 Connection Setup for External AI Agents

### 1. Claude Desktop Configuration (stdio, local)
Add the following to your `claude_desktop_config.json` (see `mcp_config.json` in
the repo root for a ready-to-copy version):

```json
{
  "mcpServers": {
    "seat-booking": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "d:/intuceo_projects/seat_booking_app",
      "env": {
        "SEAT_BOOKING_API_URL": "http://localhost:8000/api"
      }
    }
  }
}
```
Then, in the chat, ask the assistant to call `authenticate_employee` with your
own email/password before booking anything on your behalf.

### 2. WorkPilot / Intuceo.Ai Configuration (streamable-http, networked)
For a separate running application to reach this server over the network
(rather than spawning it as a local subprocess), run the MCP server as its own
service with `MCP_TRANSPORT=streamable-http` (see `mcp_server/Dockerfile` /
the root `docker-compose.yml`), then point the external agent's MCP client at
its HTTP endpoint:

```json
{
  "name": "SeatBookingIntegration",
  "type": "streamable-http",
  "url": "http://<seat-booking-mcp-host>:8100/mcp"
}
```

Flow for the external application, matching
`External AI Agent -> MCP Client -> Seat Booking MCP Server -> Existing FastAPI Services -> PostgreSQL`:
1. Connect the MCP client to the URL above and list tools.
2. Call `authenticate_employee(email, password)` with the real employee's own
   credentials; store the returned `auth_token`.
3. Call any other tool (e.g. `search_available_seats`, `book_seat`,
   `get_my_bookings`, `cancel_my_booking`) passing that `auth_token` - actions
   are attributed to that real employee, and bookings land in the same
   Postgres database the web app itself reads from (visible immediately in the
   User Portal's "My Bookings").

---

## 🧪 Testing the MCP Server

Full end-to-end test (tool discovery, real login, browse, book, verify via the
plain REST API, cancel) against a running backend:

```bash
# From the repository root, with the backend running and scripts/seed.py already applied:
python -m mcp_server.test_mcp
```

Run the server directly (stdio) to test tool discovery interactively:

```bash
python -m mcp_server.server
```
