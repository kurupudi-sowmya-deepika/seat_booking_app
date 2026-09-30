"""
test_reports.py – admin reporting & analytics tests (pytest version).

Covers:
  • GET /api/reports/revenue
  • GET /api/reports/occupancy
  • GET /api/reports/export (CSV)
  • RBAC: regular user cannot access admin reports
"""
import pytest


@pytest.mark.e2e
async def test_revenue_report_requires_admin(http_client, user_headers):
    res = await http_client.get("/api/reports/revenue", headers=user_headers)
    assert res.status_code == 403


@pytest.mark.e2e
async def test_revenue_report_accessible_by_admin(http_client, admin_headers):
    res = await http_client.get("/api/reports/revenue", headers=admin_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "total_revenue" in data
    assert "total_confirmed_bookings" in data


@pytest.mark.e2e
async def test_occupancy_report_accessible_by_admin(http_client, admin_headers):
    res = await http_client.get("/api/reports/occupancy", headers=admin_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "overall_seat_occupancy" in data
    assert "overall_room_utilization" in data


@pytest.mark.e2e
async def test_csv_export_contains_headers(http_client, admin_headers):
    res = await http_client.get("/api/reports/export", headers=admin_headers)
    assert res.status_code == 200, res.text
    # First line of a valid CSV export must contain the column headers
    assert "Booking ID" in res.text or "booking_id" in res.text.lower()


@pytest.mark.e2e
async def test_admin_kpi_stats(http_client, admin_headers):
    res = await http_client.get("/api/admin/stats", headers=admin_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "total_users" in data
    assert "total_bookings" in data
    assert isinstance(data["total_users"], int)
