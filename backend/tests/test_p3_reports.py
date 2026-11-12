"""P3 — relatórios: previsto (due_on) x realizado (received_on), sem duplicação; estorno sai do realizado."""
from datetime import date

from test_p3_receipts import borrower, funded, pay


def test_due_october_paid_november(client, a, clock):
    clock.today = date(2026, 9, 1)
    bid = borrower(client, a)
    loan = funded_on(client, a, bid)
    i1 = loan["installments"][0]
    assert i1["due_on"] == "2026-10-10"
    clock.today = date(2026, 11, 5)
    rid = pay(client, a, bid, [{"installment_id": i1["id"]}], "1150.00", received_on="2026-11-05").json()["id"]
    oct_ = client.get("/loans/reports/monthly?month=2026-10", headers=a).json()
    nov = client.get("/loans/reports/monthly?month=2026-11", headers=a).json()
    sep = client.get("/loans/reports/monthly?month=2026-09", headers=a).json()
    assert sep["realized"]["disbursed"] == "3000.00" and sep["realized"]["net_cashflow"] == "-3000.00"
    assert oct_["expected"]["scheduled_total"] == "1150.00" and oct_["expected"]["already_paid"] == "1150.00"
    assert oct_["realized"]["received_total"] == "0.00"
    assert nov["realized"] == {"disbursed": "0.00", "received_total": "1150.00", "principal_recovered": "1000.00",
                               "interest_received": "150.00", "adjustments_received": "0.00", "net_cashflow": "1150.00",
                               "receipts_count": 1}
    assert nov["expected"]["scheduled_total"] == "1150.00" and nov["expected"]["overdue_open"] == "0.00"
    # estorno remove do realizado (sem duplicar)
    client.post(f"/loans/receipts/{rid}/reverse", json={"reason": "erro"}, headers=a)
    nov2 = client.get("/loans/reports/monthly?month=2026-11", headers=a).json()
    assert nov2["realized"]["received_total"] == "0.00" and nov2["realized"]["receipts_count"] == 0
    oct2 = client.get("/loans/reports/monthly?month=2026-10", headers=a).json()
    assert oct2["expected"]["overdue_open"] == "1150.00"


def funded_on(client, h, bid):
    body = {"interest_method": "fixed_addon", "rate": "5", "frequency": "monthly", "start_on": "2026-09-01",
            "borrower_id": bid, "principal": "3000.00", "installment_count": 3, "first_due_on": "2026-10-10",
            "idempotency_key": "c-oct-0001"}
    lid = client.post("/loans/contracts", json=body, headers=h).json()["id"]
    return client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-09-01", "idempotency_key": "f-oct-0001"}, headers=h).json()


def test_dashboard_portfolio(client, a, clock):
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    pay(client, a, bid, [{"installment_id": l1["installments"][0]["id"]}], "1150.00", received_on="2026-11-09")
    d = client.get("/loans/dashboard", headers=a).json()
    assert (d["principal_outstanding"], d["interest_future"], d["total_receivable"]) == ("2000.00", "300.00", "2300.00")
    clock.today = date(2027, 1, 11)
    d = client.get("/loans/dashboard", headers=a).json()
    assert d["overdue_count"] == 1 and d["overdue_amount"] == "1150.00"


def test_draft_not_in_reports(client, a):
    bid = borrower(client, a)
    body = {"interest_method": "fixed_addon", "rate": "5", "frequency": "monthly", "start_on": "2026-11-09", "borrower_id": bid,
            "principal": "500.00", "installment_count": 1, "first_due_on": "2026-12-10", "idempotency_key": "c-draft-01"}
    client.post("/loans/contracts", json=body, headers=a)
    assert client.get("/loans/dashboard", headers=a).json()["total_receivable"] == "0.00"
    assert client.get("/loans/reports/monthly?month=2026-12", headers=a).json()["expected"]["scheduled_total"] == "0.00"
    assert client.get("/loans/reports/monthly?month=2026-11", headers=a).json()["realized"]["disbursed"] == "0.00"


def test_reports_isolated_between_users(client, a, b):
    bid = borrower(client, a)
    funded(client, a, bid)
    assert client.get("/loans/dashboard", headers=b).json()["total_receivable"] == "0.00"
    assert client.get("/loans/reports/monthly?month=2026-11", headers=b).json()["realized"]["disbursed"] == "0.00"


def test_month_param_validated(client, a):
    assert client.get("/loans/reports/monthly?month=2026-13", headers=a).status_code == 422
    assert client.get("/loans/reports/monthly?month=abc", headers=a).status_code == 422


def test_statement_consolidated(client, a):
    bid = borrower(client, a)
    funded(client, a, bid)
    funded(client, a, bid, principal="1000.00", n=4)
    s = client.get(f"/loans/borrowers/{bid}/statement", headers=a).json()
    assert len(s["loans"]) == 2 and s["open_total"] == "4650.00"


def test_reverse_receipt_monthly_report_does_not_duplicate_or_post_current_month(client, a, clock):
    """R6-G: regra vigente recalcula mês original; auditoria mantém recibo estornado."""
    bid = borrower(client, a)
    loan = funded_on(client, a, bid)
    inst = loan["installments"][0]["id"]
    clock.today = date(2026, 12, 20)
    receipt = pay(client, a, bid, [{"installment_id": inst}], "1150.00",
                  received_on="2026-11-05").json()
    assert client.get("/loans/reports/monthly?month=2026-11", headers=a).json()["realized"]["received_total"] == "1150.00"
    rv = client.post(f"/loans/receipts/{receipt['id']}/reverse", headers=a,
                     json={"reason": "lançamento incorreto"})
    assert rv.status_code == 200
    assert client.post(f"/loans/receipts/{receipt['id']}/reverse", headers=a,
                       json={"reason": "outra vez"}).status_code == 409
    november = client.get("/loans/reports/monthly?month=2026-11", headers=a).json()
    december = client.get("/loans/reports/monthly?month=2026-12", headers=a).json()
    assert november["realized"]["received_total"] == "0.00"
    assert november["realized"]["receipts_count"] == 0
    assert december["realized"]["received_total"] == "0.00"
    assert december["realized"]["net_cashflow"] == "0.00"
    assert sum(int(r["amount"].replace(".", "")) for r in
               client.get("/loans/receipts", headers=a).json() if not r["reversed"]) == 0
    assert client.get("/loans/receipts", headers=a).json()[0]["reversed"] is True
