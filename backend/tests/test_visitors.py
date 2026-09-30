"""
test_visitors.py – visitor management tests (pytest version).

Covers:
  • Visitor pre-registration
  • Check-in lifecycle
  • Check-out lifecycle
"""
import pytest
from datetime import date, timedelta


@pytest.mark.e2e
async def test_visitor_pre_registration(http_client, user_headers, branches):
    branch = branches[0]
    visit_date = (date.today() + timedelta(days=3)).isoformat()

    payload = {
        "branch_id": str(branch["id"]),
        "visitor_name": "Test Visitor (pytest)",
        "visitor_email": "pytest.visitor@test.example.com",
        "visitor_phone": "+91 00000 00000",
        "purpose": "pytest harness – visitor lifecycle test",
        "visit_date": visit_date,
        "expected_arrival_time": "10:00:00",
    }
    res = await http_client.post("/api/visitors/", json=payload, headers=user_headers)
    assert res.status_code == 200, f"Visitor creation failed: {res.text}"
    visitor = res.json()
    assert visitor["visitor_name"] == payload["visitor_name"]
    assert visitor["status"] in ("SCHEDULED", "EXPECTED", "PENDING")
    return visitor["id"]


@pytest.mark.e2e
async def test_visitor_checkin_checkout_lifecycle(http_client, user_headers, branches):
    """Full visitor pass lifecycle: register → check-in → check-out."""
    branch = branches[0]
    visit_date = (date.today() + timedelta(days=4)).isoformat()

    # Pre-register
    payload = {
        "branch_id": str(branch["id"]),
        "visitor_name": "Lifecycle Visitor (pytest)",
        "visitor_email": "pytest.lifecycle@test.example.com",
        "purpose": "pytest harness – full lifecycle",
        "visit_date": visit_date,
        "expected_arrival_time": "14:00:00",
    }
    reg_res = await http_client.post("/api/visitors/", json=payload, headers=user_headers)
    assert reg_res.status_code == 200, reg_res.text
    visitor_id = reg_res.json()["id"]

    # Check-in
    ci_res = await http_client.post(f"/api/visitors/{visitor_id}/check-in", headers=user_headers)
    assert ci_res.status_code == 200, f"Check-in failed: {ci_res.text}"
    assert ci_res.json()["status"] == "CHECKED_IN"

    # Check-out
    co_res = await http_client.post(f"/api/visitors/{visitor_id}/check-out", headers=user_headers)
    assert co_res.status_code == 200, f"Check-out failed: {co_res.text}"
    assert co_res.json()["status"] == "CHECKED_OUT"


@pytest.mark.e2e
async def test_visitor_requires_auth(http_client, branches):
    payload = {
        "branch_id": str(branches[0]["id"]),
        "visitor_name": "Anon",
        "visitor_email": "anon@test.com",
        "purpose": "x",
        "visit_date": "2026-12-01",
    }
    res = await http_client.post("/api/visitors/", json=payload)
    assert res.status_code == 401
