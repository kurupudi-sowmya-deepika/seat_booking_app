"""
test_auth.py – authentication & authorization tests (pytest version).

Covers:
  • Local email+password login for admin and regular user
  • GET /auth/me profile endpoint
  • Entra ID forged-token security regression (CVE guard)
  • Service-token (X-Service-Token) trusted-caller path
  • Role-based access control (admin-only routes)
"""
from __future__ import annotations

import pytest
import jwt


# ──────────────────────────────────────────────────────────────────────────
# Login / profile
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.auth
async def test_admin_login_returns_token(http_client):
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "admin@example.com", "password": "admin123"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data.get("token_type", "bearer").lower() == "bearer"


@pytest.mark.e2e
@pytest.mark.auth
async def test_user_login_returns_token(http_client):
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "user@example.com", "password": "user123"},
    )
    assert res.status_code == 200, res.text
    assert "access_token" in res.json()


@pytest.mark.e2e
@pytest.mark.auth
async def test_wrong_password_returns_401(http_client):
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "admin@example.com", "password": "wrongpassword"},
    )
    assert res.status_code == 401


@pytest.mark.e2e
@pytest.mark.auth
async def test_unknown_user_returns_401(http_client):
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "nobody@notreal.com", "password": "password"},
    )
    assert res.status_code == 401


@pytest.mark.e2e
@pytest.mark.auth
async def test_admin_me_profile(http_client, admin_headers, admin_user):
    res = await http_client.get("/api/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "ADMIN"
    assert "email" in data
    assert "name" in data


@pytest.mark.e2e
@pytest.mark.auth
async def test_user_me_profile(http_client, user_headers, regular_user):
    res = await http_client.get("/api/auth/me", headers=user_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] in ("USER", "ADMIN")
    assert "email" in data


# ──────────────────────────────────────────────────────────────────────────
# RBAC: admin-only routes
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.auth
async def test_regular_user_cannot_access_admin_stats(http_client, user_headers):
    res = await http_client.get("/api/admin/stats", headers=user_headers)
    assert res.status_code == 403


@pytest.mark.e2e
@pytest.mark.auth
async def test_admin_can_access_admin_stats(http_client, admin_headers):
    res = await http_client.get("/api/admin/stats", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "total_bookings" in data


# ──────────────────────────────────────────────────────────────────────────
# Entra ID security regression (forged-token guard)
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.auth
async def test_entra_forged_token_rejected(http_client):
    """A random string masquerading as a Microsoft JWT must be rejected."""
    res = await http_client.post(
        "/api/auth/login/entra",
        json={
            "token": "not-a-real-jwt.fake.signature",
            "email": "admin@example.com",
            "name": "Forged Admin",
            "oid": "attacker-supplied-oid",
        },
    )
    assert res.status_code == 401, (
        f"Forged-token exploit path should be closed (expected 401, got {res.status_code})"
    )


@pytest.mark.e2e
@pytest.mark.auth
async def test_entra_self_signed_jwt_rejected(http_client):
    """A well-formed JWT signed with an attacker key (not in Microsoft JWKS) must be rejected."""
    forged = jwt.encode(
        {"preferred_username": "admin@example.com", "oid": "attacker-oid", "name": "Attacker"},
        "attacker-controlled-secret",
        algorithm="HS256",
    )
    res = await http_client.post("/api/auth/login/entra", json={"token": forged})
    assert res.status_code == 401, (
        f"Self-signed forgery should be rejected (expected 401, got {res.status_code})"
    )


@pytest.mark.e2e
@pytest.mark.auth
async def test_local_login_unaffected_by_entra_fix(http_client):
    """Local email+password login must still work after the Entra security fix."""
    res = await http_client.post(
        "/api/auth/login",
        data={"username": "admin@example.com", "password": "admin123"},
    )
    assert res.status_code == 200
    assert res.json().get("access_token")


# ──────────────────────────────────────────────────────────────────────────
# Service-token (X-Service-Token) trusted-caller path
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.auth
async def test_service_token_no_credentials_returns_401(http_client):
    res = await http_client.get("/api/auth/me")
    assert res.status_code == 401


@pytest.mark.e2e
@pytest.mark.auth
async def test_service_token_wrong_secret_returns_401(http_client):
    from app.core.config import settings
    original = settings.WORKPILOT_SERVICE_TOKEN
    settings.WORKPILOT_SERVICE_TOKEN = "test-secret"
    try:
        res = await http_client.get(
            "/api/auth/me",
            headers={"X-Service-Token": "wrong-secret", "X-On-Behalf-Of-Email": "admin@example.com"},
        )
        assert res.status_code == 401
    finally:
        settings.WORKPILOT_SERVICE_TOKEN = original


@pytest.mark.e2e
@pytest.mark.auth
async def test_service_token_unknown_email_returns_401(http_client):
    from app.core.config import settings
    original = settings.WORKPILOT_SERVICE_TOKEN
    secret = "test-service-secret-known"
    settings.WORKPILOT_SERVICE_TOKEN = secret
    try:
        res = await http_client.get(
            "/api/auth/me",
            headers={"X-Service-Token": secret, "X-On-Behalf-Of-Email": "nobody@notreal.invalid"},
        )
        assert res.status_code == 401
    finally:
        settings.WORKPILOT_SERVICE_TOKEN = original


@pytest.mark.e2e
@pytest.mark.auth
async def test_service_token_valid_returns_200_as_user(http_client):
    from app.core.config import settings
    original = settings.WORKPILOT_SERVICE_TOKEN
    secret = "test-service-secret-valid"
    settings.WORKPILOT_SERVICE_TOKEN = secret
    try:
        res = await http_client.get(
            "/api/auth/me",
            # Case-insensitive email lookup
            headers={"X-Service-Token": secret, "X-On-Behalf-Of-Email": "USER@EXAMPLE.COM"},
        )
        assert res.status_code == 200
        assert res.json()["email"].lower() == "user@example.com"
    finally:
        settings.WORKPILOT_SERVICE_TOKEN = original


@pytest.mark.e2e
@pytest.mark.auth
async def test_service_token_disabled_when_unset(http_client):
    from app.core.config import settings
    original = settings.WORKPILOT_SERVICE_TOKEN
    settings.WORKPILOT_SERVICE_TOKEN = ""
    try:
        res = await http_client.get(
            "/api/auth/me",
            headers={"X-Service-Token": "", "X-On-Behalf-Of-Email": "user@example.com"},
        )
        assert res.status_code == 401
    finally:
        settings.WORKPILOT_SERVICE_TOKEN = original
