"""
test_health.py – basic smoke tests that require only a running FastAPI process
(no seeded database data). These always run first and catch startup/config regressions.
"""
import pytest


@pytest.mark.e2e
async def test_health_endpoint(http_client):
    """GET /health must return 200 and {status: ok}."""
    res = await http_client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.e2e
async def test_root_redirects_to_docs(http_client):
    """GET / must redirect to /docs (FastAPI's OpenAPI UI)."""
    res = await http_client.get("/", follow_redirects=False)
    assert res.status_code in (301, 302, 307, 308)
    assert "/docs" in res.headers.get("location", "")


@pytest.mark.e2e
async def test_openapi_schema_available(http_client):
    """The OpenAPI JSON schema must be reachable."""
    res = await http_client.get("/api/openapi.json")
    assert res.status_code == 200
    data = res.json()
    assert "openapi" in data
    assert "paths" in data


@pytest.mark.e2e
async def test_unauthenticated_protected_route_returns_401(http_client):
    """Accessing a protected endpoint without a token must return 401."""
    res = await http_client.get("/api/auth/me")
    assert res.status_code == 401
