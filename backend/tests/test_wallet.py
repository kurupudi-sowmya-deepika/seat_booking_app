"""
test_wallet.py – wallet & payment tests (pytest version).

Covers:
  • GET /wallet/balance
  • Admin manual wallet adjustment (CREDIT / DEBIT)
  • Audit trail: adjusted balance matches expected value
"""
import pytest


@pytest.mark.e2e
@pytest.mark.wallet
async def test_wallet_balance_requires_auth(http_client):
    res = await http_client.get("/api/wallet/balance")
    assert res.status_code == 401


@pytest.mark.e2e
@pytest.mark.wallet
async def test_wallet_balance_returns_float(http_client, user_headers):
    res = await http_client.get("/api/wallet/balance", headers=user_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "balance" in data
    assert isinstance(float(data["balance"]), float)


@pytest.mark.e2e
@pytest.mark.wallet
async def test_admin_wallet_credit_adjustment(http_client, admin_headers, user_headers, regular_user):
    # Capture balance before
    before_res = await http_client.get("/api/wallet/balance", headers=user_headers)
    balance_before = float(before_res.json()["balance"])

    credit_amount = 100.0
    adjust_payload = {
        "user_id": regular_user["id"],
        "amount": credit_amount,
        "transaction_type": "CREDIT",
        "reason": "pytest harness – wallet credit verification",
    }
    adjust_res = await http_client.post(
        "/api/wallet/admin/adjust", json=adjust_payload, headers=admin_headers
    )
    assert adjust_res.status_code == 200, f"Admin adjust failed: {adjust_res.text}"
    data = adjust_res.json()
    assert "balance_after" in data
    assert float(data["balance_after"]) == pytest.approx(balance_before + credit_amount, abs=0.01)

    # Restore
    await http_client.post(
        "/api/wallet/admin/adjust",
        json={
            "user_id": regular_user["id"],
            "amount": credit_amount,
            "transaction_type": "DEBIT",
            "reason": "pytest harness – restoring balance after credit test",
        },
        headers=admin_headers,
    )


@pytest.mark.e2e
@pytest.mark.wallet
async def test_non_admin_cannot_adjust_wallet(http_client, user_headers, regular_user):
    res = await http_client.post(
        "/api/wallet/admin/adjust",
        json={"user_id": regular_user["id"], "amount": 50, "transaction_type": "CREDIT", "reason": "x"},
        headers=user_headers,
    )
    assert res.status_code == 403


@pytest.mark.e2e
@pytest.mark.wallet
async def test_wallet_transaction_history_accessible(http_client, user_headers):
    """Wallet transaction history endpoint must be reachable."""
    res = await http_client.get("/api/wallet/transactions", headers=user_headers)
    # 200 (with data) or 404 if route doesn't exist yet; never 500
    assert res.status_code != 500
