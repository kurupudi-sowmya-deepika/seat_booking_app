"""Regression test for the /auth/login/entra signature-verification fix.

Before the fix, this endpoint decoded the incoming "Microsoft" token with
`verify_signature: False` and trusted the client-supplied `email`/`oid` fields
ahead of the token's own (unverified) claims - meaning anyone could log in as
any existing user (e.g. the seeded admin) by POSTing a fake token plus that
user's email, with no real Microsoft credential at all. This script proves
that exploit path is closed and that real local-password login is unaffected.

Run with the venv active from `backend/`:
    python tests/test_entra_auth_security.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import jwt
from httpx import AsyncClient, ASGITransport

from app.main import app


async def main():
    print("==================================================")
    print("   ENTRA LOGIN SECURITY REGRESSION TEST           ")
    print("==================================================")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n[1] Forged token + a real user's email in the request body (the original exploit shape)...")
        res = await client.post("/api/auth/login/entra", json={
            "token": "not-a-real-jwt.fake.signature",
            "email": "admin@example.com",
            "name": "Forged Admin",
            "oid": "attacker-supplied-oid",
        })
        assert res.status_code == 401, f"Expected 401 for a forged token, got {res.status_code}: {res.text}"
        print("[OK] Forged token + spoofed email is rejected (401), not silently logged in as that user.")

        print("\n[2] Syntactically valid JWT self-signed with an attacker-controlled secret, claiming to be the admin...")
        forged = jwt.encode(
            {"preferred_username": "admin@example.com", "oid": "attacker-oid", "name": "Attacker"},
            "attacker-controlled-secret",
            algorithm="HS256",
        )
        res = await client.post("/api/auth/login/entra", json={"token": forged})
        assert res.status_code == 401, f"Expected 401 for a self-signed forgery, got {res.status_code}: {res.text}"
        print("[OK] A well-formed but unsigned-by-Microsoft JWT is rejected (401) - no key in Microsoft's JWKS matches it.")

        print("\n[3] Confirming real local email+password login still works unaffected...")
        res = await client.post("/api/auth/login", data={"username": "admin@example.com", "password": "admin123"})
        assert res.status_code == 200, f"Local admin login should still work: {res.text}"
        assert res.json().get("access_token"), "Expected a real access_token from local login"
        print("[OK] Local email+password login is unaffected by the Entra fix.")

    print("\n==================================================")
    print("   ALL ENTRA LOGIN SECURITY TESTS PASSED!         ")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
