"""Regression test for the trusted-caller (X-Service-Token + X-On-Behalf-Of-Email) auth path.

Read-only: only calls GET /auth/me. Run from `backend/` with the venv active:
    python tests/test_service_token_auth.py <existing-active-user-email>
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

SECRET = "test-service-secret"


async def main(user_email: str) -> int:
    settings.WORKPILOT_SERVICE_TOKEN = SECRET
    failures = []

    def check(name: str, ok: bool) -> None:
        print(("PASS " if ok else "FAIL ") + name)
        if not ok:
            failures.append(name)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        me = "/api/auth/me"
        check("no credentials -> 401", (await c.get(me)).status_code == 401)
        check("wrong service token -> 401", (await c.get(me, headers={"X-Service-Token": "nope", "X-On-Behalf-Of-Email": user_email})).status_code == 401)
        check("service token without email -> 401", (await c.get(me, headers={"X-Service-Token": SECRET})).status_code == 401)
        check("unknown email is never auto-created -> 401", (await c.get(me, headers={"X-Service-Token": SECRET, "X-On-Behalf-Of-Email": "nobody-here@example.invalid"})).status_code == 401)
        ok = await c.get(me, headers={"X-Service-Token": SECRET, "X-On-Behalf-Of-Email": user_email.upper()})
        check("valid token + existing user (case-insensitive) -> 200 as that user", ok.status_code == 200 and ok.json()["email"].lower() == user_email.lower())

        settings.WORKPILOT_SERVICE_TOKEN = ""
        check("feature disabled when unset -> 401", (await c.get(me, headers={"X-Service-Token": "", "X-On-Behalf-Of-Email": user_email})).status_code == 401)
    return 1 if failures else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python tests/test_service_token_auth.py <existing-active-user-email>")
    sys.exit(asyncio.run(main(sys.argv[1])))
