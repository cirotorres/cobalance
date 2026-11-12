"""P3 / R3 — recebimentos, consolidação atômica, idempotência, concorrência, estorno,
ajustes manuais, antecipações e amortização Price. PostgreSQL real descartável."""
import threading
from datetime import date

import pytest
from sqlalchemy import text

from db.database import engine
from loans import service

BASE = {"interest_method": "fixed_addon", "rate": "5", "frequency": "monthly", "start_on": "2026-11-09"}
_seq = {"n": 0}


def key(prefix="k"):
    _seq["n"] += 1
    return f"{prefix}-{_seq['n']:06d}"


def borrower(client, h, name="Cleide"):
    return client.post("/loans/borrowers", json={"name": name}, headers=h).json()["id"]


def funded(client, h, bid, principal="3000.00", n=3, first="2026-12-10", **kw):
    body = {**BASE, "borrower_id": bid, "principal": principal, "installment_count": n, "first_due_on": first,
            "idempotency_key": key("c"), **kw}
    r = client.post("/loans/contracts", json=body, headers=h)
    assert r.status_code == 201, r.text
    lid = r.json()["id"]
    r = client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-11-09", "idempotency_key": key("f")}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def detail(client, h, lid):
    return client.get(f"/loans/contracts/{lid}", headers=h).json()


def pay(client, h, bid, items, amount, kind="full", received_on="2026-11-09", **kw):
    body = {"borrower_id": bid, "received_on": received_on, "kind": kind, "amount": amount, "items": items,
            "idempotency_key": kw.pop("idempotency_key", key("r")), **kw}
    return client.post("/loans/receipts", json=body, headers=h)


def q(sql, **p):
    with engine.connect() as c:
        return c.execute(text(sql), p).fetchall()


# ------------------------------------------------------------------ integral e consolidado
def test_full_receipt_single_installment(client, a):
    bid = borrower(client, a)
    loan = funded(client, a, bid)
    i1 = loan["installments"][0]
    r = pay(client, a, bid, [{"installment_id": i1["id"]}], "1150.00")
    assert r.status_code == 201, r.text
    rc = r.json()
    assert rc["amount"] == "1150.00" and len(rc["allocations"]) == 1
    al = rc["allocations"][0]
    assert (al["principal"], al["interest"], al["adjustment"]) == ("1000.00", "150.00", "0.00")
    d = detail(client, a, loan["id"])
    assert d["installments"][0]["status"] == "PAID" and d["remaining"] == "2300.00"


def test_consolidated_receipt_two_loans_same_borrower(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    l2 = funded(client, a, bid, principal="1000.00", n=4)
    items = [{"installment_id": l1["installments"][0]["id"]}, {"installment_id": l2["installments"][0]["id"]}]
    assert pay(client, a, bid, items, "1450.01").status_code == 409  # total divergente
    r = pay(client, a, bid, items, "1450.00")
    assert r.status_code == 201
    assert len(r.json()["allocations"]) == 2
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 1
    assert q("SELECT count(*) FROM loan_receipt_allocations")[0][0] == 2


def test_consolidated_rejects_other_borrower_installment_atomically(client, a):
    b1, b2 = borrower(client, a, "Cleide"), borrower(client, a, "Lívia")
    l1, l2 = funded(client, a, b1), funded(client, a, b2, principal="1000.00", n=4)
    items = [{"installment_id": l1["installments"][0]["id"]}, {"installment_id": l2["installments"][0]["id"]}]
    r = pay(client, a, b1, items, "1450.00")
    assert r.status_code == 422
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 0
    assert detail(client, a, l1["id"])["installments"][0]["status"] == "PENDING"


def test_consolidated_with_already_paid_rolls_back_all(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1, i2 = l1["installments"][0]["id"], l1["installments"][1]["id"]
    assert pay(client, a, bid, [{"installment_id": i1}], "1150.00").status_code == 201
    r = pay(client, a, bid, [{"installment_id": i2}, {"installment_id": i1}], "2300.00")
    assert r.status_code == 409
    assert detail(client, a, l1["id"])["installments"][1]["status"] == "PENDING"
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 1


def test_duplicate_installment_in_items_rejected(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    assert pay(client, a, bid, [{"installment_id": i1}, {"installment_id": i1}], "2300.00").status_code == 422


def test_cross_user_receipt_404_no_leak(client, a, b):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    bb = borrower(client, b, "Bruno")
    assert pay(client, b, bid, [{"installment_id": i1}], "1150.00").status_code == 404
    assert pay(client, b, bb, [{"installment_id": i1}], "1150.00").status_code == 404
    rid = pay(client, a, bid, [{"installment_id": i1}], "1150.00").json()["id"]
    assert client.get(f"/loans/receipts/{rid}", headers=b).status_code == 404
    assert client.post(f"/loans/receipts/{rid}/reverse", json={"reason": "hack"}, headers=b).status_code == 404
    assert client.get(f"/loans/contracts/{l1['id']}", headers=b).status_code == 404
    assert client.get("/loans/receipts", headers=b).json() == []


def test_receipt_with_foreign_pix_account_404(client, a, b):
    pix_b = client.post("/loans/pix-accounts", json={"label": "B", "key": "b@b.co", "holder_name": "B", "city": "X"}, headers=b).json()
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    r = pay(client, a, bid, [{"installment_id": l1["installments"][0]["id"]}], "1150.00", pix_account_id=pix_b["id"])
    assert r.status_code == 404


def test_draft_loan_cannot_receive(client, a):
    bid = borrower(client, a)
    body = {**BASE, "borrower_id": bid, "principal": "100.00", "installment_count": 1, "first_due_on": "2026-12-10",
            "idempotency_key": key("c")}
    loan = client.post("/loans/contracts", json=body, headers=a).json()
    assert pay(client, a, bid, [{"installment_id": loan["installments"][0]["id"]}], "105.00").status_code == 409


def test_receipt_date_in_future_rejected(client, a, clock):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    r = pay(client, a, bid, [{"installment_id": l1["installments"][0]["id"]}], "1150.00", received_on="2026-11-10")
    assert r.status_code == 422


# ------------------------------------------------------------------ parcial excepcional
def test_partial_requires_explicit_kind_and_is_proportional(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    # full com amount menor → 409 (não vira parcial silenciosamente)
    assert pay(client, a, bid, [{"installment_id": i1}], "575.00").status_code == 409
    r = pay(client, a, bid, [{"installment_id": i1, "amount": "575.00"}], "575.00", kind="partial")
    assert r.status_code == 201, r.text
    al = r.json()["allocations"][0]
    assert (al["principal"], al["interest"]) == ("500.00", "75.00")
    inst = detail(client, a, l1["id"])["installments"][0]
    assert inst["status"] == "PARTIALLY_PAID" and inst["remaining"] == "575.00"
    assert pay(client, a, bid, [{"installment_id": i1, "amount": "575.01"}], "575.01", kind="partial").status_code == 422
    assert pay(client, a, bid, [{"installment_id": i1}], "575.00").status_code == 201
    assert detail(client, a, l1["id"])["installments"][0]["status"] == "PAID"
    comp = q("SELECT sum(principal_cents), sum(interest_cents) FROM loan_receipt_allocations")[0]
    assert tuple(comp) == (100000, 15000)


def test_partial_odd_cents(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    r = pay(client, a, bid, [{"installment_id": i1, "amount": "0.01"}], "0.01", kind="partial")
    al = r.json()["allocations"][0]
    assert (al["principal"], al["interest"]) == ("0.01", "0.00")


def test_partial_item_amount_sum_must_match(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    assert pay(client, a, bid, [{"installment_id": i1, "amount": "10.00"}], "11.00", kind="partial").status_code == 409
    assert pay(client, a, bid, [{"installment_id": i1}], "10.00", kind="partial").status_code == 422


# ------------------------------------------------------------------ antecipação sem recálculo
def test_anticipation_fixed_keeps_original_due_date(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i3 = l1["installments"][2]
    r = pay(client, a, bid, [{"installment_id": i3["id"]}], "1150.00", received_on="2026-11-09")
    assert r.status_code == 201
    assert r.json()["allocations"][0]["kind"] == "anticipation"
    inst = detail(client, a, l1["id"])["installments"][2]
    assert inst["due_on"] == i3["due_on"] and inst["status"] == "PAID"


# ------------------------------------------------------------------ idempotência e corrida
def test_receipt_replay_and_conflict(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    r1 = pay(client, a, bid, [{"installment_id": i1}], "1150.00", idempotency_key="pay-dup-1")
    r2 = pay(client, a, bid, [{"installment_id": i1}], "1150.00", idempotency_key="pay-dup-1")
    assert r1.status_code == 201 and r2.status_code == 200 and r1.json()["id"] == r2.json()["id"]
    r3 = pay(client, a, bid, [{"installment_id": i1}], "1150.00", idempotency_key="pay-dup-1", note="outro")
    assert r3.status_code == 409
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 1


def test_same_idempotency_key_different_users_independent(client, a, b):
    ba, bb = borrower(client, a), borrower(client, b)
    la, lb = funded(client, a, ba), funded(client, b, bb)
    assert pay(client, a, ba, [{"installment_id": la["installments"][0]["id"]}], "1150.00", idempotency_key="shared-key").status_code == 201
    assert pay(client, b, bb, [{"installment_id": lb["installments"][0]["id"]}], "1150.00", idempotency_key="shared-key").status_code == 201


@pytest.mark.parametrize("same_key", [False, True])
def test_concurrent_double_pay(client, a, same_key):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    results, barrier = [], threading.Barrier(6)

    def go(n):
        barrier.wait()
        k = "race-same" if same_key else f"race-key-{n}"
        results.append(pay(client, a, bid, [{"installment_id": i1}], "1150.00", idempotency_key=k).status_code)

    ts = [threading.Thread(target=go, args=(n,)) for n in range(6)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert results.count(201) == 1
    assert set(results) <= ({201, 200} if same_key else {201, 409})
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 1
    assert q("SELECT paid_principal_cents, paid_interest_cents FROM loan_installments WHERE id=:i", i=i1)[0] == (100000, 15000)


def test_failure_mid_receipt_rolls_back_everything(client, a, monkeypatch):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    items = [{"installment_id": l1["installments"][0]["id"]}, {"installment_id": l1["installments"][1]["id"]}]
    original, calls = service._apply_allocation, {"n": 0}

    def boom(*args, **kw):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("falha simulada no meio do recibo")
        return original(*args, **kw)

    monkeypatch.setattr(service, "_apply_allocation", boom)
    with pytest.raises(RuntimeError):
        pay(client, a, bid, items, "2300.00")
    monkeypatch.undo()
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 0
    assert q("SELECT count(*) FROM loan_receipt_allocations")[0][0] == 0
    assert q("SELECT count(*) FROM loan_idempotency_keys WHERE scope='receipt'")[0][0] == 0
    assert all(i["status"] == "PENDING" for i in detail(client, a, l1["id"])["installments"])


# ------------------------------------------------------------------ quitação e estorno
def test_settle_and_reverse(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid, principal="1000.00", n=1)
    i1 = l1["installments"][0]["id"]
    rid = pay(client, a, bid, [{"installment_id": i1}], "1050.00").json()["id"]
    assert detail(client, a, l1["id"])["status"] == "SETTLED"
    r = client.post(f"/loans/receipts/{rid}/reverse", json={"reason": "lançado por engano"}, headers=a)
    assert r.status_code == 200 and r.json()["reversed"] is True
    d = detail(client, a, l1["id"])
    assert d["status"] == "ACTIVE" and d["installments"][0]["status"] == "PENDING" and d["remaining"] == "1050.00"
    assert client.post(f"/loans/receipts/{rid}/reverse", json={"reason": "de novo"}, headers=a).status_code == 409
    assert q("SELECT count(*) FROM loan_receipts")[0][0] == 1  # nada deletado
    assert q("SELECT count(*) FROM loan_events WHERE type='receipt_reversed'")[0][0] == 1
    # pode pagar de novo após estorno
    assert pay(client, a, bid, [{"installment_id": i1}], "1050.00").status_code == 201


def test_reverse_partial_then_full_consistency(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    r1 = pay(client, a, bid, [{"installment_id": i1, "amount": "333.33"}], "333.33", kind="partial").json()
    pay(client, a, bid, [{"installment_id": i1}], "816.67")
    client.post(f"/loans/receipts/{r1['id']}/reverse", json={"reason": "erro"}, headers=a)
    inst = detail(client, a, l1["id"])["installments"][0]
    assert inst["status"] == "PARTIALLY_PAID" and inst["remaining"] == "333.33"
    row = q("SELECT paid_principal_cents+paid_interest_cents FROM loan_installments WHERE id=:i", i=i1)[0][0]
    alloc = q("SELECT sum(a.principal_cents+a.interest_cents) FROM loan_receipt_allocations a JOIN loan_receipts r "
              "ON r.id=a.receipt_id WHERE r.reversed_at IS NULL AND a.installment_id=:i", i=i1)[0][0]
    assert row == alloc == 81667


# ------------------------------------------------------------------ atraso e ajuste manual
def test_overdue_is_derived_and_values_unchanged(client, a, clock):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    clock.today = date(2026, 12, 11)
    d = detail(client, a, l1["id"])
    assert d["installments"][0]["overdue"] is True and d["installments"][0]["total"] == "1150.00"
    assert d["installments"][1]["overdue"] is False and d["overdue_count"] == 1
    clock.today = date(2026, 12, 10)
    assert detail(client, a, l1["id"])["installments"][0]["overdue"] is False  # no dia não está atrasada


def test_manual_adjustment_separate_and_reversible(client, a, b, clock):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    clock.today = date(2026, 12, 20)
    body = {"amount": "25.00", "reason": "atraso de 10 dias combinado", "idempotency_key": key("adj")}
    assert client.post(f"/loans/installments/{i1}/adjustments", json=body, headers=b).status_code == 404
    r = client.post(f"/loans/installments/{i1}/adjustments", json=body, headers=a)
    assert r.status_code == 201
    assert client.post(f"/loans/installments/{i1}/adjustments", json=body, headers=a).status_code == 200  # replay
    inst = detail(client, a, l1["id"])["installments"][0]
    assert (inst["interest"], inst["adjustment"], inst["total"]) == ("150.00", "25.00", "1175.00")
    adj_id = r.json()["id"]
    rv = client.post(f"/loans/adjustments/{adj_id}/reverse", headers=a)
    assert rv.status_code == 200
    assert detail(client, a, l1["id"])["installments"][0]["total"] == "1150.00"
    assert client.post(f"/loans/adjustments/{adj_id}/reverse", headers=a).status_code == 409
    # novo ajuste, pago, não pode ser estornado
    r2 = client.post(f"/loans/installments/{i1}/adjustments", json={**body, "idempotency_key": key("adj")}, headers=a).json()
    rc = pay(client, a, bid, [{"installment_id": i1}], "1175.00", received_on="2026-12-20")
    assert rc.status_code == 201 and rc.json()["allocations"][0]["adjustment"] == "25.00"
    assert client.post(f"/loans/adjustments/{r2['id']}/reverse", headers=a).status_code == 409


def test_adjustment_on_paid_installment_rejected(client, a):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    i1 = l1["installments"][0]["id"]
    pay(client, a, bid, [{"installment_id": i1}], "1150.00")
    r = client.post(f"/loans/installments/{i1}/adjustments", json={"amount": "1.00", "reason": "x atraso", "idempotency_key": key("adj")}, headers=a)
    assert r.status_code == 409


# ------------------------------------------------------------------ Price: amortização extraordinária
PRICE = {"interest_method": "price", "rate": "2"}


def price_loan(client, h, bid, n=6, principal="6000.00"):
    return funded(client, h, bid, principal=principal, n=n, **PRICE)


def amortize(client, h, bid, lid, amount, strategy, received_on="2026-11-09", **kw):
    return client.post("/loans/receipts", json={"borrower_id": bid, "received_on": received_on, "kind": "price_amortization",
                                                "amount": amount, "loan_id": lid, "strategy": strategy,
                                                "idempotency_key": kw.pop("idempotency_key", key("am")), **kw}, headers=h)


def test_prepayment_preview_has_no_side_effects(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    before = q("SELECT count(*) FROM loan_installments")[0][0]
    r = client.post(f"/loans/contracts/{l1['id']}/prepayment-preview",
                    json={"amount": "3000.00", "strategy": "reduce_installment", "on": "2026-11-09"}, headers=a)
    assert r.status_code == 200, r.text
    assert len(r.json()["installments"]) == 6
    assert q("SELECT count(*) FROM loan_installments")[0][0] == before
    assert detail(client, a, l1["id"])["current_version"] == 1


def test_amortization_reduce_installment(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    preview = client.post(f"/loans/contracts/{l1['id']}/prepayment-preview",
                          json={"amount": "3000.00", "strategy": "reduce_installment", "on": "2026-11-09"}, headers=a).json()
    r = amortize(client, a, bid, l1["id"], "3000.00", "reduce_installment")
    assert r.status_code == 201, r.text
    assert r.json()["allocations"][0]["kind"] == "amortization" and r.json()["allocations"][0]["principal"] == "3000.00"
    d = detail(client, a, l1["id"])
    assert d["current_version"] == 2
    assert [i["due_on"] for i in d["installments"]] == [i["due_on"] for i in l1["installments"]]
    assert [i["total"] for i in d["installments"]] == [i["total"] for i in preview["installments"]]
    assert float(d["installments"][0]["total"]) < float(l1["installments"][0]["total"])
    assert sum(int(i["principal"].replace(".", "")) for i in d["installments"]) == 300000
    # versão anterior preservada (inativa)
    assert q("SELECT count(*) FROM loan_installments WHERE loan_id=:l AND NOT is_active", l=l1["id"])[0][0] == 6
    assert q("SELECT count(*) FROM loan_schedule_versions WHERE loan_id=:l", l=l1["id"])[0][0] == 2


def test_amortization_reduce_term(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    A = l1["installments"][0]["total"]
    r = amortize(client, a, bid, l1["id"], "3000.00", "reduce_term")
    assert r.status_code == 201, r.text
    d = detail(client, a, l1["id"])
    assert len(d["installments"]) < 6
    assert all(i["total"] == A for i in d["installments"][:-1])
    assert sum(int(i["principal"].replace(".", "")) for i in d["installments"]) == 300000


def test_amortization_keeps_overdue_and_paid_installments(client, a, clock):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    first, second = l1["installments"][0], l1["installments"][1]
    clock.today = date(2026, 12, 10)
    pay(client, a, bid, [{"installment_id": first["id"]}], first["total"], received_on="2026-12-10")
    clock.today = date(2027, 1, 20)  # 2ª (10/01) vencida em aberto
    r = amortize(client, a, bid, l1["id"], "1000.00", "reduce_installment", received_on="2027-01-20")
    assert r.status_code == 201, r.text
    d = detail(client, a, l1["id"])
    ids = [i["id"] for i in d["installments"]]
    assert first["id"] in ids and second["id"] in ids  # paga e vencida preservadas
    ov = next(i for i in d["installments"] if i["id"] == second["id"])
    assert ov["overdue"] and ov["total"] == second["total"]
    assert len(d["installments"]) == 6
    # principal total ativo = P - amortização
    tot_p = sum(int(i["principal"].replace(".", "")) for i in d["installments"])
    assert tot_p == 600000 - 100000


def test_amortization_full_balance_settles_future(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid, n=2, principal="1000.00")
    r = amortize(client, a, bid, l1["id"], "1000.00", "reduce_term")
    assert r.status_code == 201
    d = detail(client, a, l1["id"])
    assert d["status"] == "SETTLED" and d["installments"] == [] and d["remaining"] == "0.00"


def test_amortization_validations(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    assert amortize(client, a, bid, l1["id"], "6000.01", "reduce_term").status_code == 422
    assert amortize(client, a, bid, l1["id"], "0.00", "reduce_term").status_code == 422
    fixed = funded(client, a, bid)
    assert amortize(client, a, bid, fixed["id"], "100.00", "reduce_term").status_code == 422
    other = borrower(client, a, "Outra")
    assert amortize(client, a, other, l1["id"], "100.00", "reduce_term").status_code == 422


def test_amortization_blocked_when_future_partially_paid(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    i2 = l1["installments"][1]["id"]
    pay(client, a, bid, [{"installment_id": i2, "amount": "10.00"}], "10.00", kind="partial", received_on="2026-11-09")
    assert amortize(client, a, bid, l1["id"], "1000.00", "reduce_term").status_code == 409


def test_amortization_reversal_restores_previous_schedule(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    rid = amortize(client, a, bid, l1["id"], "3000.00", "reduce_installment").json()["id"]
    r = client.post(f"/loans/receipts/{rid}/reverse", json={"reason": "erro de digitação"}, headers=a)
    assert r.status_code == 200, r.text
    d = detail(client, a, l1["id"])
    assert d["current_version"] == 3
    assert [(i["due_on"], i["total"]) for i in d["installments"]] == [(i["due_on"], i["total"]) for i in l1["installments"]]
    assert d["remaining"] == l1["remaining"]


def test_amortization_reversal_blocked_after_new_schedule_paid(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    rid = amortize(client, a, bid, l1["id"], "3000.00", "reduce_installment").json()["id"]
    new_first = detail(client, a, l1["id"])["installments"][0]
    pay(client, a, bid, [{"installment_id": new_first["id"]}], new_first["total"], received_on="2026-11-09")
    assert client.post(f"/loans/receipts/{rid}/reverse", json={"reason": "tarde"}, headers=a).status_code == 409


def test_old_version_installment_cannot_be_paid(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    amortize(client, a, bid, l1["id"], "3000.00", "reduce_installment")
    old = l1["installments"][0]
    assert pay(client, a, bid, [{"installment_id": old["id"]}], old["total"]).status_code == 409


def test_invariants_after_mixed_operations(client, a):
    bid = borrower(client, a)
    l1 = price_loan(client, a, bid)
    i1 = l1["installments"][0]
    pay(client, a, bid, [{"installment_id": i1["id"]}], i1["total"], received_on="2026-11-09")
    amortize(client, a, bid, l1["id"], "1234.56", "reduce_term")
    # principal recuperado + principal pendente ativo == P
    rec = q("SELECT coalesce(sum(a.principal_cents),0) FROM loan_receipt_allocations a JOIN loan_receipts r ON r.id=a.receipt_id "
            "WHERE r.reversed_at IS NULL AND a.loan_id=:l", l=l1["id"])[0][0]
    pend = q("SELECT sum(principal_cents-paid_principal_cents) FROM loan_installments WHERE loan_id=:l AND is_active", l=l1["id"])[0][0]
    assert rec + pend == 600000
