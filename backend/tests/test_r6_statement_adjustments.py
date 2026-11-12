"""SPEC003-R6: acréscimos visíveis no extrato, isolamento e estorno auditável."""
from datetime import date

from test_p3_receipts import borrower, funded, key, pay


def test_statement_lists_adjustments_and_updates_after_reversal(client, a, b, clock):
    bid = borrower(client, a)
    loan = funded(client, a, bid)
    inst = loan["installments"][0]["id"]
    clock.today = date(2026, 12, 20)
    created = client.post(
        f"/loans/installments/{inst}/adjustments",
        json={"amount": "25.00", "reason": "acordo de atraso", "idempotency_key": key("r6adj")},
        headers=a,
    )
    assert created.status_code == 201, created.text
    adj_id = created.json()["id"]
    stmt = client.get(f"/loans/borrowers/{bid}/statement", headers=a)
    assert stmt.status_code == 200
    assert stmt.json()["adjustments"] == [{
        "id": adj_id, "loan_id": loan["id"], "installment_id": inst,
        "installment_number": 1, "amount": "25.00", "reason": "acordo de atraso",
        "reversed": False, "can_reverse": True, "blocked_reason": None,
    }]
    assert client.get(f"/loans/borrowers/{bid}/statement", headers=b).status_code == 404
    assert client.post(f"/loans/adjustments/{adj_id}/reverse", headers=b).status_code == 404
    assert client.post(f"/loans/adjustments/{adj_id}/reverse", headers=a).status_code == 200
    assert client.post(f"/loans/adjustments/{adj_id}/reverse", headers=a).status_code == 409
    stmt2 = client.get(f"/loans/borrowers/{bid}/statement", headers=a).json()
    assert stmt2["open_total"] == "3450.00"
    assert stmt2["adjustments"][0]["reversed"] is True
    assert stmt2["adjustments"][0]["can_reverse"] is False
    assert stmt2["adjustments"][0]["blocked_reason"] == "Acréscimo já estornado."


def test_statement_blocks_reversal_of_received_adjustment(client, a, clock):
    bid = borrower(client, a)
    loan = funded(client, a, bid)
    inst = loan["installments"][0]["id"]
    clock.today = date(2026, 12, 20)
    created = client.post(
        f"/loans/installments/{inst}/adjustments",
        json={"amount": "25.00", "reason": "acordo de atraso", "idempotency_key": key("r6adj")},
        headers=a,
    ).json()
    assert pay(client, a, bid, [{"installment_id": inst}], "1175.00").status_code == 201
    adj = client.get(f"/loans/borrowers/{bid}/statement", headers=a).json()["adjustments"][0]
    assert adj["id"] == created["id"]
    assert not adj["can_reverse"]
    assert "recebimento" in adj["blocked_reason"].lower()
    assert client.post(f"/loans/adjustments/{created['id']}/reverse", headers=a).status_code == 409
