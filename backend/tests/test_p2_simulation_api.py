"""P2 — simulação sem persistência e preview idêntico ao persistido."""
from sqlalchemy import text

from db.database import engine

CLEIDE = {"principal": "3000.00", "interest_method": "fixed_addon", "rate": "5", "installment_count": 3,
          "frequency": "monthly", "start_on": "2026-11-09", "first_due_on": "2026-12-10"}


def _count(table):
    with engine.connect() as c:
        return c.execute(text(f"SELECT count(*) FROM {table}")).scalar()


def test_simulate_cleide_no_persistence(client, a):
    r = client.post("/loans/simulate", json=CLEIDE, headers=a)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [i["total"] for i in body["installments"]] == ["1150.00"] * 3
    assert body["totals"] == {"principal": "3000.00", "interest": "450.00", "total": "3450.00"}
    assert [i["due_on"] for i in body["installments"]] == ["2026-12-10", "2027-01-10", "2027-02-10"]
    assert body["rate_unit"] == "per_installment_on_principal"
    assert len(body["terms_hash"]) == 64
    assert _count("loans") == 0 and _count("loan_installments") == 0


def test_simulate_livia(client, a):
    r = client.post("/loans/simulate", json={**CLEIDE, "principal": "1000", "installment_count": 4}, headers=a)
    assert [i["total"] for i in r.json()["installments"]] == ["300.00"] * 4


def test_simulate_price_monthly_unit(client, a):
    r = client.post("/loans/simulate", json={**CLEIDE, "interest_method": "price"}, headers=a)
    body = r.json()
    assert body["rate_unit"] == "monthly_effective"
    assert [i["total"] for i in body["installments"]][:2] == ["1101.63", "1101.63"]
    assert body["totals"]["principal"] == "3000.00"


def test_simulate_validation_errors(client, a):
    bad = [
        {**CLEIDE, "principal": 3000.0},
        {**CLEIDE, "principal": "3000,00"},
        {**CLEIDE, "rate": "-1"},
        {**CLEIDE, "installment_count": 0},
        {**CLEIDE, "installment_count": 121},
        {**CLEIDE, "frequency": "every_x_days"},
        {**CLEIDE, "first_due_on": "2026-11-09"},           # = start_on
        {**CLEIDE, "frequency": "manual", "manual_dates": ["2026-12-01"]},
        {**CLEIDE, "foo": 1},
        {**CLEIDE, "principal": "0.01"},
    ]
    for p in bad:
        assert client.post("/loans/simulate", json=p, headers=a).status_code == 422, p


def test_simulate_requires_module(client, user_a):
    assert client.post("/loans/simulate", json=CLEIDE, headers=user_a).status_code == 403


def _borrower(client, h, name="Cleide"):
    return client.post("/loans/borrowers", json={"name": name}, headers=h).json()["id"]


def test_create_contract_matches_preview_and_is_draft(client, a):
    bid = _borrower(client, a)
    sim = client.post("/loans/simulate", json=CLEIDE, headers=a).json()
    r = client.post("/loans/contracts", json={**CLEIDE, "borrower_id": bid, "terms_hash": sim["terms_hash"],
                                              "idempotency_key": "create-0001"}, headers=a)
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["status"] == "DRAFT"
    assert [(i["due_on"], i["principal"], i["interest"]) for i in c["installments"]] == \
        [(i["due_on"], i["principal"], i["interest"]) for i in sim["installments"]]


def test_create_contract_rejects_stale_terms_hash(client, a):
    bid = _borrower(client, a)
    r = client.post("/loans/contracts", json={**CLEIDE, "borrower_id": bid, "terms_hash": "0" * 64,
                                              "idempotency_key": "create-0002"}, headers=a)
    assert r.status_code == 409


def test_create_contract_idempotent_double_submit(client, a):
    bid = _borrower(client, a)
    body = {**CLEIDE, "borrower_id": bid, "idempotency_key": "create-0003"}
    r1 = client.post("/loans/contracts", json=body, headers=a)
    r2 = client.post("/loans/contracts", json=body, headers=a)
    assert r1.status_code == 201 and r2.status_code == 200 and r1.json()["id"] == r2.json()["id"]
    assert _count("loans") == 1
    r3 = client.post("/loans/contracts", json={**body, "principal": "10.00"}, headers=a)
    assert r3.status_code == 409


def test_create_contract_borrower_of_other_user_404(client, a, b):
    bid = _borrower(client, a)
    r = client.post("/loans/contracts", json={**CLEIDE, "borrower_id": bid, "idempotency_key": "create-0004"}, headers=b)
    assert r.status_code == 404
    assert _count("loans") == 0


def test_fund_activates_and_validates_dates(client, a, b):
    bid = _borrower(client, a)
    lid = client.post("/loans/contracts", json={**CLEIDE, "borrower_id": bid, "idempotency_key": "create-0005"}, headers=a).json()["id"]
    assert client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-12-11", "idempotency_key": "fund-0001"}, headers=a).status_code == 422
    assert client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-11-09", "idempotency_key": "fund-0002"}, headers=b).status_code == 404
    r = client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-11-09", "method": "pix", "idempotency_key": "fund-0003"}, headers=a)
    assert r.status_code == 200 and r.json()["status"] == "ACTIVE" and r.json()["funded_on"] == "2026-11-09"
    # replay idêntico OK; outro fund → 409
    assert client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-11-09", "method": "pix", "idempotency_key": "fund-0003"}, headers=a).status_code == 200
    assert client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-11-09", "idempotency_key": "fund-0004"}, headers=a).status_code == 409
    assert client.post(f"/loans/contracts/{lid}/cancel", headers=a).status_code == 409


def test_cancel_draft(client, a):
    bid = _borrower(client, a)
    lid = client.post("/loans/contracts", json={**CLEIDE, "borrower_id": bid, "idempotency_key": "create-0006"}, headers=a).json()["id"]
    r = client.post(f"/loans/contracts/{lid}/cancel", headers=a)
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    assert client.post(f"/loans/contracts/{lid}/fund", json={"funded_on": "2026-11-09", "idempotency_key": "fund-0005"}, headers=a).status_code == 409

def test_price_extreme_final_installment_warning_without_changing_math(client, a):
    payload = {**CLEIDE, "interest_method": "price", "principal": "999999.99",
               "rate": "9.99", "installment_count": 120}
    r = client.post("/loans/simulate", json=payload, headers=a)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["installments"]) == 120
    assert data["warnings"][0]["code"] == "PRICE_LAST_INSTALLMENT_DISTORTION"
    assert data["warnings"][0]["first_installment"] == "99901.09"
    assert data["warnings"][0]["last_installment"] == "98068.81"
    assert data["warnings"][0]["difference"] == "-1832.28"
    assert "arredondamento" in data["warnings"][0]["message"].lower()
    assert sum(int(x["principal"].replace(".", "")) for x in data["installments"]) == 99999999
    assert _count("loans") == 0


def test_price_normal_schedule_no_distortion_warning(client, a):
    r = client.post("/loans/simulate", json={**CLEIDE, "interest_method": "price"}, headers=a)
    assert r.status_code == 200
    assert r.json()["warnings"] == []


def test_price_non_amortizing_extreme_stays_rejected(client, a):
    r = client.post("/loans/simulate", json={**CLEIDE, "interest_method": "price", "principal": "1000.00",
                                           "rate": "50", "installment_count": 120}, headers=a)
    assert r.status_code == 422
    assert "amortiza" in r.text.lower()
