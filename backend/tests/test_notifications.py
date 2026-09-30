"""
test_notifications.py – in-app notification tests (pytest version).
"""
import pytest


@pytest.mark.e2e
async def test_notifications_list_accessible(http_client, user_headers):
    res = await http_client.get("/api/notifications/", headers=user_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    # Must contain at least the shape we depend on
    assert "notifications" in data
    assert "unread_count" in data
    assert isinstance(data["notifications"], list)
    assert isinstance(data["unread_count"], int)


@pytest.mark.e2e
async def test_notifications_requires_auth(http_client):
    res = await http_client.get("/api/notifications/")
    assert res.status_code == 401


@pytest.mark.e2e
async def test_mark_all_read(http_client, user_headers):
    res = await http_client.post("/api/notifications/read-all", headers=user_headers)
    assert res.status_code == 200, res.text

    # After marking all read, unread count should be 0
    list_res = await http_client.get("/api/notifications/", headers=user_headers)
    assert list_res.json()["unread_count"] == 0
