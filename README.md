# Seat Booking App - Workspace Booking Application

A complete, production-ready workspace and seat booking application. 
Built with **React (TypeScript)**, **FastAPI**, and **PostgreSQL**.

## Features
- **AI Chatbot Booking:** Natural language conversational interface (OpenAI GPT-5.4 Mini with tool/function calling) to find and book seats, meeting/conference rooms, and day passes seamlessly.
- **Prepaid Wallet System:** Add credits via Stripe and instantly book seats without leaving the app.
- **Dual Authentication:** Local Email/Password + Microsoft Entra ID (SSO)
- **Interactive Seat Map:** Real-time visual selection of seats, with time slots picked as checkboxes sourced from the admin-configured Time Slots list (not a generated grid) - selecting several books that seat across each checked slot.
- **Multi-Day Day Passes:** Book a Day Pass for a number of consecutive days in one flow; capacity is checked across every day before anything is created.
- **Booking Engine:** Concurrency-safe double-booking prevention using PostgreSQL partial indexes
- **Payment Processing:** Integrated with Stripe Checkout & Webhooks
- **Admin Dashboard:** Full CRUD management for Locations, Branches, Rooms, Seats, and Time Slots, plus a System Settings page (org policies, auth toggles, AI concierge) that persists to the database
- **Premium UI:** Glassmorphism, animations, and a Tailwind v4 + CSS-custom-property design system ("Bosch Light" - see `design.md`)

## Tech Stack
- **Frontend:** React 19, Vite, TypeScript, React Router v6, MSAL React, Axios, Tailwind v4, Lucide React
- **Backend:** Python 3.10+, FastAPI, SQLAlchemy 2.0 (Async), asyncpg, Alembic, PyJWT
- **AI:** OpenAI (`openai` Python SDK), default model `gpt-5.4-mini`, via Chat Completions tool/function calling
- **Database:** PostgreSQL
- **Payments:** Stripe

---

## 🚀 Setup Instructions

### 1. Database Setup
1. Install and start PostgreSQL.
2. Create a new database named `seat_booking`:
   ```sql
   CREATE DATABASE seat_booking;
   ```

### 2. Environment Configuration
1. The project uses a unified configuration approach. Copy `.env.example` (or create a new `.env` file) in the **root** of the repository:
   ```bash
   cp .env.example .env
   ```
2. Update the `DATABASE_URL` in `.env` to point to your local PostgreSQL instance (e.g., `postgresql+asyncpg://postgres:password@localhost:5432/seat_booking`).
3. Set your `STRIPE_SECRET_KEY`, `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-5.4-mini`), `VITE_ENTRA_CLIENT_ID`, and `VITE_STRIPE_PUBLISHABLE_KEY` in the root `.env` file. Both frontend and backend are configured to read from this central file.

### 3. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Activate the virtual environment:
   ```bash
   # Windows
   .\.venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
3. Apply database migrations:
   ```bash
   alembic upgrade head
   ```
4. Seed the database with sample locations, rooms, and seats:
   ```bash
   python scripts/seed.py
   ```
5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### 4. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 4. Stripe Webhook Testing (Optional)
To test the full payment cycle locally, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:8000/api/payments/webhook
```
Update your `backend/.env` with the webhook secret output by the command.

---

## Default Credentials
After running the seed script, you can log in with:

**Admin:**
- Email: `admin@example.com`
- Password: `admin123`

**User:**
- Email: `user@example.com`
- Password: `user123`

## Architecture Highlights
- **Concurrency Control:** Double-booking is prevented at the database level using a partial unique index on `(seat_id, booking_date, time_slot_id)` where `status IN ('PENDING', 'CONFIRMED')`.
- **MSAL Integration:** The frontend uses `@azure/msal-react` for standard popup authentication, while the backend verifies the claims and seamlessly links the Entra ID to a local profile.
- **Design System:** Tailwind v4 utility classes plus a small set of CSS Custom Properties (colors, radii) defined in `frontend/src/index.css`; the root font-size is intentionally bumped above the 16px browser default so Tailwind's rem-based type and spacing scale render larger app-wide.
- **AI Chatbot:** `backend/app/chatbot/` - `tools.py` holds the provider-agnostic booking/search functions (the only code that touches the database), `openai_service.py` is the sole file that talks to OpenAI (client setup, auto-generated tool schemas, the tool-calling loop), and `service.py` wires them together. Booking-mutating tools never write to the database directly - they return a confirmation payload that the frontend renders as a card, and the actual booking still goes through the normal `/api/bookings` endpoint after the user confirms.
- **Multi-slot / multi-day bookings:** Checking several Time Slots on Book Desk/Seat, or setting Day Pass "Number of Days" > 1, creates one booking per slot/day through the existing `POST /api/bookings/` endpoint (no duplicate booking logic) - each is independently validated (availability, capacity, wallet balance) by the backend.
- **Admin Settings persistence:** `system_settings` is a single-row table (`app/models/system_settings.py`) read/written via `GET`/`PUT /api/admin/settings`; the frontend fetches it on load and saves through the API instead of only holding values in local component state.
