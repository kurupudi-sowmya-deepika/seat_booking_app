# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Seat Booking App" (Bosch-branded internally as "SeatSync") — an enterprise workspace booking platform: desk/seat booking, day passes, meeting & conference rooms, a prepaid wallet (Stripe top-ups), an AI booking chatbot (OpenAI GPT-5.4 Mini), and dual local/Microsoft Entra ID authentication.

- Frontend: `frontend/` — React 19 + TypeScript + Vite, React Router v6, MSAL React, Axios, Tailwind v4 + hand-written CSS variables (see `frontend/src/index.css` / `App.css`).
- Backend: `backend/` — FastAPI, SQLAlchemy 2.0 (async), asyncpg, Alembic, PyJWT/passlib, Stripe, `openai` (GPT-5.4 Mini, via Chat Completions tool/function calling).
- Database: PostgreSQL.
- Config: a single root-level `.env` is read by both apps (backend via `env_file = "../.env"` in `app/core/config.py`; frontend via Vite's `envDir: '../'` in `vite.config.ts`).

## Commands

### Backend (run from `backend/`)
```bash
# activate the venv first (Windows: .venv\Scripts\activate)
alembic upgrade head            # apply migrations
alembic revision -m "message"   # create a new migration (hand-written, not autogenerate — see below)
python scripts/seed.py          # seed sample locations/branches/rooms/seats + admin/user accounts
python scripts/wipe.py          # wipe seeded data
uvicorn app.main:app --reload --port 8000
```

### Frontend (run from `frontend/`)
```bash
npm install --legacy-peer-deps   # required: peer-dep conflicts otherwise
npm run dev                      # Vite dev server on port 3000
npm run build                    # tsc -b && vite build
npm run lint                     # oxlint
npm run preview
```

### Tests
There is no pytest suite — tests are standalone async scripts that spin up the FastAPI app in-process via `httpx.ASGITransport` and hit real routes against whatever database `DATABASE_URL` points to (they log in as the seeded `admin@example.com` / `user@example.com`, so `scripts/seed.py` must have been run first). Run them directly with the venv active from `backend/`:
```bash
python tests/test_api_flow.py
python tests/test_advanced_features.py
```
There's no way to run a single "test case" — each file is one linear script; comment out later sections to shortcut a run.

### Stripe webhook (local)
```bash
stripe listen --forward-to localhost:8000/api/payments/webhook
```
Put the printed webhook secret into the root `.env` as `STRIPE_WEBHOOK_SECRET`.

## Architecture

### Config & settings
`backend/app/core/config.py` defines a `pydantic-settings` `Settings` class reading `DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_NAME` (assembled into an async `postgresql+asyncpg://` URL), `JWT_SECRET`, Stripe keys, `OPENAI_API_KEY`/`OPENAI_MODEL` (default `gpt-5.4-mini`), and Entra ID settings — all from the **root** `.env`, not `backend/.env`. `backend/.env.example` shows an older flat `DATABASE_URL` shape; the actual `Settings` model expects the split `DB_*` vars instead, so check `config.py` directly if a fresh `.env` doesn't load correctly.

### Request flow
`app/main.py` wires CORS (single allowed origin: `settings.FRONTEND_URL`) and mounts `app/api/router.py`, which aggregates one router per resource under `app/api/routes/` (auth, locations, branches, rooms, facilities, seats, day_passes, time_slots, bookings, payments, wallet, users, admin, chatbot, visitors, notifications, reports), all prefixed with `/api`. Auth is a bearer JWT validated in `app/api/deps.py` (`get_current_user`, `get_current_admin`); most routes depend on one of these.

### Domain model hierarchy
`Location` → `Branch` → `Room` (room_type: `WORKSPACE` | `MEETING_ROOM` | `CONFERENCE_ROOM`) → `Seat`. `DayPass` belongs to a `Branch`. `Booking` is a single unified table for all four `BookingType`s (`SEAT`, `DAY_PASS`, `MEETING_ROOM`, `CONFERENCE_ROOM`) with nullable `seat_id`/`day_pass_id`/`room_id`/`time_slot_id` columns depending on type — seat bookings use `time_slot_id` (fixed slots from the `TimeSlot` table), room bookings use free-form `start_time`/`end_time`. See `app/models/booking.py` and `app/models/location.py`.

Double-booking prevention is enforced in the database, not just application code: a partial unique index on `(seat_id, booking_date, time_slot_id)` where `status IN ('PENDING','CONFIRMED')` (`ix_unique_active_booking` in `app/models/booking.py`). Room bookings (free time ranges) are checked for overlap in application code (`start_time < end AND end_time > start`) rather than a DB constraint — see `ChatbotTools.get_meeting_or_conference_rooms` and the equivalent logic in `app/api/routes/bookings.py` for the pattern.

Migrations in `backend/alembic/versions/` are hand-written (not generated from `alembic revision --autogenerate` against current models in every case) — check an existing migration's style before adding a new one.

Seat bookings from `Booking.tsx` now actually use `time_slot_id`: the "Select Time Slots" UI is checkboxes rendered from the real, admin-configured `GET /api/time-slots/` list (not a generated 15-minute grid), and checking several slots creates one `POST /api/bookings/` call per checked `time_slot_id` for the same seat (looping the existing endpoint — no new booking-creation code path). Availability for that seat is computed as the intersection of `GET /api/bookings/availability/seat?time_slot_id=...` across every checked slot, so a seat only shows as bookable if it's actually free in all of them. The same "loop the existing single-day/single-slot endpoint" pattern is used for Day Pass's "Number of Days": `DayPass.tsx` books `numDays` consecutive `POST /api/bookings/` calls (one per date), pre-checking `GET /api/bookings/availability/day-pass?day_pass_id=...` across the whole range first so it fails before creating anything rather than partway through. **Gotcha**: building that date range with `new Date(dateString).toISOString().split('T')[0]` is timezone-unsafe — it silently shifts a day backwards in any timezone ahead of UTC (e.g. IST). Use date-component arithmetic instead (`new Date(y, m - 1, d + i)` read back via `getFullYear()`/`getMonth()`/`getDate()`, never `toISOString()`) — see `getDateRange()` in `DayPass.tsx`.

A multi-slot/multi-day purchase is N independent bookings, not one multi-slot/multi-day record — each is validated independently by the backend (capacity, overlap, wallet balance), so a partial failure partway through is possible and both pages surface which slots/days actually succeeded rather than assuming all-or-nothing.

### Wallet / payments
Users have one `Wallet` (`app/models/wallet.py`) topped up via Stripe Checkout; `app/api/routes/payments.py` handles the `checkout.session.completed` webhook, using `CreditTransaction.reference_id` for idempotency and `SELECT ... FOR UPDATE` on the wallet row to serialize concurrent top-ups. `DEMO_WALLET_MODE`/`DEMO_INITIAL_CREDIT_EMAIL`/`DEMO_INITIAL_CREDIT_AMOUNT` in settings support a no-Stripe demo path — check how these are used before assuming Stripe is live in dev.

### Authentication
Two providers feed the same `User`/`Token` flow: local email+password (`bcrypt` via passlib, JWT via `PyJWT`) and Microsoft Entra ID (frontend uses `@azure/msal-react`; the ID token is POSTed to `/api/auth/login/entra`, which decodes it and upserts a `User`, linking by email if a local account already exists — `AuthProvider.LOCAL` gets promoted to `BOTH`). The frontend stores the resulting app JWT in `localStorage` and attaches it via an Axios interceptor (`frontend/src/services/api.ts`); `AuthContext` (`frontend/src/context/AuthContext.tsx`) resolves the current user by calling `/api/auth/me` on load.

### AI chatbot
`app/chatbot/` implements an OpenAI-backed booking assistant, kept deliberately separate from the manual booking flow:
- `tools.py` — `ChatbotTools`, a set of `async` methods (location/branch/room/seat/day-pass search & detail lookups, availability checks, wallet balance & transaction history, recommend seat/room, `resolve_booking_conflict` for real alternatives, etc.) that are the *only* way the model touches data. The model never queries Postgres directly. All `ilike`-based name lookups (branch/room by name) go through the `_find_branch`/`_find_room_by_name` helpers, not a raw `scalar_one_or_none()` — that throws on an ambiguous match. This module is provider-agnostic — it has no OpenAI-specific code in it at all.
- `openai_service.py` — the only file that imports the `openai` package. `get_client()` builds an `AsyncOpenAI` from `settings.OPENAI_API_KEY` (raising `OpenAIConfigError` if unset). `build_tool_schema()` turns a bound `ChatbotTools` method into an OpenAI `tools` function-schema entry via `pydantic.create_model` over its type hints, so tool schemas can't drift from the actual Python signatures. `run_agentic_chat()` runs the manual Chat Completions tool-calling loop (Chat Completions is stateless, so the full transcript is resent each round): it dispatches each `tool_call` to the matching bound method, feeds the JSON result back as a `role: "tool"` message, and loops (capped at `MAX_TOOL_ITERATIONS`) until the model returns a plain-text answer. A tool call with unknown name, malformed JSON arguments, or a Python `TypeError` (missing/extra/mistyped args) never crashes the turn — `_execute_tool_call` catches it and feeds the model an `{"error": ...}` dict instead.
- `service.py` — `process_chat_message` is the provider-agnostic orchestrator: builds the tool schema list, calls `run_agentic_chat`, and shapes the result into `ChatResponse`. Conversation history is kept in an in-memory `dict` (`conversations`), keyed by `conversation_key(user_id, conversation_id)` (namespaced per user — **not persisted**, so it resets on backend restart and won't work across multiple backend workers/instances). History entries are a mix of plain dicts (user/tool messages) and raw SDK `ChatCompletionMessage` objects (assistant turns) — that's fine since they never leave process memory.
- Tools that would mutate state (`confirm_intent_to_book`, `confirm_intent_to_cancel`, `confirm_intent_to_reschedule`, `intent_add_credits`) don't perform the action themselves — they return an `{"action": ..., "payload": ...}` dict. `run_agentic_chat` notices this shape in a tool result and surfaces it in `ChatResponse.metadata`, letting the frontend (`ChatbotWidget.tsx`) render a confirmation card and call the real booking endpoint only after explicit user confirmation.
- Routes live in `app/api/routes/chatbot.py` (`POST /api/chatbot/message`, `DELETE /api/chatbot/conversations/{id}`), both auth-gated like everything else; failures are caught per OpenAI SDK exception type (`RateLimitError`, `AuthenticationError`, `APITimeoutError`/`APIConnectionError`, generic `APIError`) and turned into a friendly in-conversation message rather than a raw 500 (never leak exception internals to the client).
- `OPENAI_BASE_URL` (optional, blank = `api.openai.com`) lets `OPENAI_API_KEY`/`OPENAI_MODEL` point at any OpenAI-compatible gateway (OpenRouter, a proxy, etc.) instead — set it only if the key isn't a native OpenAI platform key.
- **"Chatbot isn't working" troubleshooting**: because failures are caught and shown as a friendly message, the chatbot can look broken when the real cause is external, not a code regression. Before assuming a code bug, reproduce directly against `process_chat_message` (bypasses the friendly-error wrapper, shows the real exception) — e.g. run it from a `backend/` Python shell with a real `db` session and a seeded user. If `OPENAI_API_KEY` is unset, `process_chat_message` returns a friendly "not configured" message itself (logged as an error) rather than raising — check `openai.AuthenticationError` (bad/revoked/wrong-format key — the error message includes a masked preview like `sk-xt-74***9e89` which is safe to log/share) and `openai.RateLimitError` (429 — quota exhausted or zero billing credits on the OpenAI account, message body distinguishes them) first for anything that looks like a live-key problem.

### Frontend structure
`App.tsx` defines all routing: public `/login` + `/register`, a `ProtectedRoute`-gated user area under `MainLayout` (dashboard, booking, day-pass, meeting/conference rooms, visitors, my-bookings, wallet, transactions, profile), and an admin area under `AdminLayout` at `/admin/*` gated by `adminOnly` (checks `user.role === 'ADMIN'`). `LocationContext` drives a location-selection modal shown app-wide. Pages under `pages/admin/` are full CRUD screens per resource type, generally built on the shared `DataTable` component. `MainLayout` and `AdminLayout` share the same brand chrome (favicon logo + "Seat Booking App" name in the sidebar, Bosch logo in the header, the `.bosch-supergraphic` strip at the very top) — keep them in sync when editing one.

### Admin System Settings
`pages/admin/AdminSettings.tsx` persists to the backend — `GET`/`PUT /api/admin/settings` (`app/api/routes/admin.py`) read/write a single-row `system_settings` table (`app/models/system_settings.py`; the row is created with defaults on first access, there's no seed step). The frontend's `settings` state uses camelCase keys and translates to/from the API's snake_case via `toApiPayload`/`fromApiResponse` in that file. Not every field in `system_settings` has a form control yet (`cancellation_window_hours`, `daily_reminder_email` persist fine but aren't rendered in any tab) and `stripeWebhookLive` is display-only (Stripe's real webhook state isn't stored here) — check the component before assuming a value in the schema is user-editable. Persisting a setting doesn't make the rest of the app enforce it (e.g. `max_advance_booking_days` isn't yet read by the booking date pickers) — that's a separate wiring task per setting, not done by this persistence layer alone.

### Design system — "Bosch Light"
Canonical token reference is `/design.md` (root of the repo, not `frontend/`) — read it before touching colors, type, spacing, or radii. Tokens live as CSS custom properties in `frontend/src/index.css` (`--primary-color`, `--secondary-color`, `--radius-*`, `--space-*`, etc.); most page-level components consume them via Tailwind arbitrary values (e.g. `bg-[#007bc0]`) rather than `var(--x)` directly, so a token change in `index.css` doesn't automatically propagate to every page — check call sites. Key things to know:
- **Base type/spacing scale**: `html { font-size: 17.5px }` in `index.css` (the browser default is 16px) — since Tailwind's rem-based utilities (`text-xs`/`sm`/`base`, `p-*`, `gap-*`, `space-y-*`, etc.) size off the root font-size, this one rule scales font size AND spacing together across the whole app. It does **not** affect literal-pixel arbitrary values (`text-[10px]`, `w-[140px]`) — those stay fixed size regardless of this token.
- **Primary button is black, not blue.** Blue (`--primary-color` / `#007BC0`) is the *hover* color and the one reserved accent (links, focus rings, badges) — it is deliberately not the default fill for the strongest action. Don't "fix" a black button back to blue.
- Only three button roles exist: `.btn-primary`, `.btn-secondary`, `.btn-link` (see `index.css`) — don't invent a fourth.
- Font is Boschsans (proprietary, not webfont-hosted) falling back to Helvetica Neue/Arial — don't reintroduce a Google Fonts import for a different family; `font-['Inter']` overrides were deliberately stripped app-wide.
- Radius scale: `sm`=4px (buttons/inputs), `md`=8px (cards), `lg`=12px, `xl`=16px, `full`=pills. Many older pages still use ad-hoc Tailwind `rounded-xl`/`rounded-2xl`/`rounded-3xl` that predate this scale and haven't been retrofitted — new work should use the token scale, not copy the old radii.
