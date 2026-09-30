"""
SpaceHub / SeatSync – shared pytest fixtures
============================================
All tests in this directory can use these fixtures without any imports.

Usage patterns
--------------
    async def test_something(http_client, user_headers):
        res = await http_client.get("/api/locations/", headers=user_headers)
        assert res.status_code == 200

Markers
-------
  @pytest.mark.e2e   – needs a live, seeded Postgres database
  @pytest.mark.unit  – pure Python, no I/O

Notes on pytest-asyncio 1.x / session-scoped fixtures
------------------------------------------------------
pytest-asyncio 1.x creates **one event loop per scope** by default.
Session-scoped async fixtures share one loop; function-scoped ones get their
own.  To keep the Postgres connection (which is event-loop-bound) happy we
pin *all* HTTP-based fixtures to the session loop via `loop_scope="session"`.
The `asyncio_default_fixture_loop_scope = "session"` line in pytest.ini
achieves the same globally, but we make it explicit here too.
"""
from __future__ import annotations

import os
import sys
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# ── make sure `backend/` is on sys.path regardless of cwd ─────────────────
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.database import AsyncSessionLocal

# ──────────────────────────────────────────────────────────────────────────
# Core transport / HTTP client  (one instance for the whole session)
# ──────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def http_client() -> AsyncGenerator[AsyncClient, None]:
    """Single in-process AsyncClient, reused for every test in the session."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as client:
        yield client


# ──────────────────────────────────────────────────────────────────────────
# Authentication tokens / headers  (login once per session)
# ──────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def admin_token(http_client: AsyncClient) -> str:
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "admin@example.com", "password": "admin123"},
    )
    assert res.status_code == 200, f"Admin login fixture failed: {res.text}"
    return res.json()["access_token"]


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def user_token(http_client: AsyncClient) -> str:
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "user@example.com", "password": "user123"},
    )
    assert res.status_code == 200, f"User login fixture failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def user_headers(user_token: str) -> dict:
    return {"Authorization": f"Bearer {user_token}"}


# ──────────────────────────────────────────────────────────────────────────
# Seeded-data helpers (fetched once per session)
# ──────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def locations(http_client: AsyncClient):
    res = await http_client.get("/api/locations/")
    assert res.status_code == 200
    data = res.json()
    assert data, "No locations – run scripts/seed.py first"
    return data


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def branches(http_client: AsyncClient):
    res = await http_client.get("/api/branches/")
    assert res.status_code == 200
    data = res.json()
    assert data, "No branches – run scripts/seed.py first"
    return data


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def rooms(http_client: AsyncClient):
    res = await http_client.get("/api/rooms/")
    assert res.status_code == 200
    return res.json()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def seats(http_client: AsyncClient):
    res = await http_client.get("/api/seats/")
    assert res.status_code == 200
    return res.json()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def time_slots(http_client: AsyncClient):
    res = await http_client.get("/api/time-slots/")
    assert res.status_code == 200
    data = res.json()
    assert data, "No time slots – run scripts/seed.py first"
    return data


# ──────────────────────────────────────────────────────────────────────────
# Admin / user profile objects
# ──────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def admin_user(http_client: AsyncClient, admin_headers: dict) -> dict:
    res = await http_client.get("/api/auth/me", headers=admin_headers)
    assert res.status_code == 200
    return res.json()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def regular_user(http_client: AsyncClient, user_headers: dict) -> dict:
    res = await http_client.get("/api/auth/me", headers=user_headers)
    assert res.status_code == 200
    return res.json()


# ──────────────────────────────────────────────────────────────────────────
# Wallet helper (function-scoped – always reads fresh balance)
# ──────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(loop_scope="session")
async def user_wallet_balance(http_client: AsyncClient, user_headers: dict) -> float:
    """Current wallet balance; function-scoped so each test sees a fresh value."""
    res = await http_client.get("/api/wallet/balance", headers=user_headers)
    assert res.status_code == 200
    return float(res.json()["balance"])
