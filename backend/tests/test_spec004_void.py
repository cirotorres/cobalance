"""SPEC004: anulação auditável em PostgreSQL descartável, sem recibo fictício."""
from datetime import date
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text
from db.database import engine
from test_p3_receipts import borrower, funded, pay, key

BASE = {"principal": "1000.00", "interest_method": "fixed_addon", "rate": "0",
        "installment_count": 3, "frequency": "monthly", "start_on": "2026-11-09",
        "first_due_on": "2026-12-10"}


def draft(client, headers, bid, **extra):
    r = client.post("/loans/contracts", headers=headers,
                    json={**BASE, "borrower_id": bid, "idempotency_key": key("s4"), **extra})
    assert r.status_code == 201, r.text
    return r.json()


def void(client, headers, loan_id, reason="Cadastro indevido", confirm=True, idem=None):
    return client.post(f"/loans/contracts/{loan_id}/void", headers=headers,
                       json={"reason": reason, "confirm_no_transfer": confirm,
                             "idempotency_key": idem or key("v4")})


def query(sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).all()


def test_void_draft_history_filter_and_idempotency(client, a):
    bid = borrower(client, a)
    l = draft(client, a, bid)
    response = void(client, a, l["id"], idem="void-draft-0001")
    assert response.status_code == 200, response.text
    v = response.json()
    assert v["status"] == "VOIDED" and v["void_reason"] == "Cadastro indevido" and v["voided_at"]
    assert len(query("SELECT id FROM loans WHERE id=:id", id=l["id"])) == 1
    assert client.get(f"/loans/contracts/{l['id']}", headers=a).json()["status"] == "VOIDED"
    assert client.get("/loans/contracts", headers=a).json() == []
    assert [x["id"] for x in client.get("/loans/contracts?include_voided=true", headers=a).json()] == [l["id"]]
    assert client.get(f"/loans/borrowers/{bid}/statement", headers=a).json()["loans"] == []
    hist = client.get(f"/loans/borrowers/{bid}/statement?include_voided=true", headers=a).json()
    assert hist["loans"][0]["status"] == "VOIDED"
    assert void(client, a, l["id"], idem="void-draft-0001").json() == v
    assert void(client, a, l["id"], reason="Outro motivo", idem="void-draft-0001").status_code == 409
    assert void(client, a, l["id"], idem="void-another-key").status_code == 409
    assert query("SELECT type FROM loan_events WHERE loan_id=:id AND type='contract_voided'", id=l["id"]) == [("contract_voided",)]
    assert query("SELECT count(*) FROM loan_receipts")[0][0] == 0


def test_void_cancelled_and_active_corrects_false_disbursement(client, a):
    bid = borrower(client, a)
    cancelled = draft(client, a, bid)
    assert client.post(f"/loans/contracts/{cancelled['id']}/cancel", headers=a).status_code == 200
    assert void(client, a, cancelled["id"], confirm=False).status_code == 200
    active = funded(client, a, bid, principal="1000.00", n=3, rate="0")
    before = client.get("/loans/reports/monthly?month=2026-11", headers=a).json()
    assert before["realized"]["disbursed"] == "1000.00"
    assert void(client, a, active["id"], confirm=False).status_code in (409, 422)
    ok = void(client, a, active["id"])
    assert ok.status_code == 200, ok.text
    assert ok.json()["funded_on"] == "2026-11-09"  # histórico preservado
    month = client.get("/loans/reports/monthly?month=2026-11", headers=a).json()
    assert month["realized"]["disbursed"] == month["realized"]["received_total"] == "0.00"
    assert month["realized"]["net_cashflow"] == "0.00"
    assert client.get("/loans/dashboard", headers=a).json()["total_receivable"] == "0.00"
    assert client.get("/loans/contracts", headers=a).json() == []
    assert client.post(f"/loans/contracts/{active['id']}/fund", headers=a,
                       json={"funded_on": "2026-11-09", "idempotency_key": key("f")}).status_code == 409
    assert query("SELECT count(*) FROM loan_receipt_allocations")[0][0] == 0


def test_void_blocks_settled_receipts_even_reversed(client, a):
    bid = borrower(client, a)
    l = funded(client, a, bid, principal="1000.00", n=3, rate="0")
    i = l["installments"][0]["id"]
    receipt = pay(client, a, bid, [{"installment_id": i}], "333.34")
    assert receipt.status_code == 201, receipt.text
    assert void(client, a, l["id"]).status_code == 409
    assert client.post(f"/loans/receipts/{receipt.json()['id']}/reverse",
                       headers=a, json={"reason": "estorno completo"}).status_code == 200
    assert void(client, a, l["id"]).status_code == 409
    settled = funded(client, a, bid, principal="100.00", n=1, rate="0")
    assert pay(client, a, bid, [{"installment_id": settled["installments"][0]["id"]}], "100.00").status_code == 201
    assert void(client, a, settled["id"]).status_code == 409


def test_void_blocks_adjustments_charge_and_recalculation(client, a):
    bid = borrower(client, a)
    l = funded(client, a, bid)
    id_ = l["id"]
    first = l["installments"][0]["id"]
    assert client.post(f"/loans/installments/{first}/adjustments", headers=a,
                       json={"amount": "2.00", "reason": "taxa contratada", "idempotency_key": key("a")}).status_code == 201
    assert void(client, a, id_).status_code == 409

    charged = funded(client, a, bid, principal="1000.00", n=1)
    pix = client.post("/loans/pix-accounts", headers=a,
                      json={"label":"Padrão", "holder_name":"Titular", "city":"Fortaleza", "key":"s4@example.test"})
    assert pix.status_code == 201, pix.text
    charge = client.post("/loans/charges", headers=a,
                         json={"borrower_id": bid, "installment_ids": [charged["installments"][0]["id"]]})
    assert charge.status_code == 201, charge.text
    assert void(client, a, charged["id"]).status_code == 409
    assert query("SELECT status FROM loans WHERE id=:id", id=charged["id"])[0][0] == "ACTIVE"


def test_void_cross_user_module_disabled_and_strict_body(client, a, b, user_a):
    bid = borrower(client, a)
    l = draft(client, a, bid)
    assert void(client, b, l["id"]).status_code == 404
    assert void(client, a, l["id"]).status_code == 200
    assert client.get("/loans/contracts", headers=b).json() == []
    assert client.get("/loans/reports/monthly?month=2026-11", headers=b).json()["realized"]["disbursed"] == "0.00"
    assert client.post(f"/loans/contracts/{l['id']}/void", headers=a, json={}).status_code == 422
    assert client.post(f"/loans/contracts/{l['id']}/void", headers=a,
                       json={"reason":"ok", "idempotency_key":"abcde123", "confirm_no_transfer":True, "extra":1}).status_code == 422


def test_zero_rate_end_to_end_and_price_compatibility(client, a):
    bid = borrower(client, a)
    for method in ("fixed_addon", "price"):
        terms = {**BASE, "interest_method": method}
        sim = client.post("/loans/simulate", headers=a, json=terms)
        assert sim.status_code == 200, sim.text
        s = sim.json()
        assert [i["total"] for i in s["installments"]] == ["333.34", "333.33", "333.33"]
        assert s["totals"] == {"principal":"1000.00", "interest":"0.00", "total":"1000.00"}
        r = client.post("/loans/contracts", headers=a,
                        json={**terms, "borrower_id": bid, "terms_hash": s["terms_hash"], "idempotency_key": key("c")})
        assert r.status_code == 201, r.text
        funded_ = client.post(f"/loans/contracts/{r.json()['id']}/fund", headers=a,
                              json={"funded_on":"2026-11-09", "idempotency_key":key("fund")})
        assert funded_.status_code == 200
        first = funded_.json()["installments"][0]
        pay_ = pay(client, a, bid, [{"installment_id": first["id"]}], first["total"])
        assert pay_.status_code == 201
        assert pay_.json()["allocations"][0]["interest"] == "0.00"
    month = client.get("/loans/reports/monthly?month=2026-11", headers=a).json()
    assert month["realized"]["interest_received"] == "0.00"
    assert month["realized"]["disbursed"] == "2000.00"



def test_void_gate_disabled(client, a):
    bid = borrower(client, a)
    l = draft(client, a, bid)
    off = client.patch("/modules/me", headers=a, json={"loans_enabled": False})
    assert off.status_code == 200, off.text
    assert void(client, a, l["id"]).status_code == 403
    assert query("SELECT status FROM loans WHERE id=:id", id=l["id"])[0][0] == "DRAFT"


def test_void_concurrent_same_key_one_event(client, a):
    import threading
    bid = borrower(client, a)
    l = draft(client, a, bid)
    barrier = threading.Barrier(5)
    results = []
    def worker(_):
        barrier.wait()
        r = void(client, a, l["id"], idem="spec004-race-same")
        results.append(r.status_code)
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
    for t in threads: t.start()
    for t in threads: t.join(timeout=20)
    assert all(not t.is_alive() for t in threads)
    assert results == [200] * 5
    assert query("SELECT count(*) FROM loan_events WHERE loan_id=:id AND type='contract_voided'", id=l["id"])[0][0] == 1


def test_concurrent_charge_and_void_are_serialized(client, a):
    import threading
    bid = borrower(client, a)
    l = funded(client, a, bid, principal="1000.00", n=1, rate="0")
    pix = client.post("/loans/pix-accounts", headers=a, json={
        "label": "Padrão", "holder_name": "Titular", "city": "Fortaleza", "key": "race@example.test"})
    assert pix.status_code == 201, pix.text
    barrier = threading.Barrier(2)
    result = {}
    def charge():
        barrier.wait()
        r = client.post("/loans/charges", headers=a, json={
            "borrower_id": bid, "installment_ids": [l["installments"][0]["id"]]})
        result["charge"] = r.status_code
    def run_void():
        barrier.wait()
        result["void"] = void(client, a, l["id"], idem="spec004-race-void").status_code
    threads = [threading.Thread(target=charge), threading.Thread(target=run_void)]
    for t in threads: t.start()
    for t in threads: t.join(timeout=20)
    assert all(not t.is_alive() for t in threads)
    assert {result["charge"], result["void"]} == {201, 409} or {result["charge"], result["void"]} == {200, 409}
    status = query("SELECT status FROM loans WHERE id=:id", id=l["id"])[0][0]
    charges = query("SELECT count(*) FROM loan_charge_items WHERE loan_id=:id", id=l["id"])[0][0]
    assert (status == "VOIDED" and charges == 0) or (status == "ACTIVE" and charges == 1)
