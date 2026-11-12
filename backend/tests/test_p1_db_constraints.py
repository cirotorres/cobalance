"""R1 — invariantes no próprio PostgreSQL (defesa em profundidade)."""
import threading

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from conftest import TEST_URL  # noqa: F401
from db.database import engine

PIX = {"label": "N", "key": "alice@example.test", "holder_name": "Alice", "city": "Fortaleza"}


def _uid(email):
    with engine.connect() as c:
        return c.execute(text("SELECT id FROM users WHERE email=:e"), {"e": email}).scalar()


def test_db_rejects_second_default_pix(client, a):
    client.post("/loans/pix-accounts", json=PIX, headers=a)
    uid = _uid("alice@example.test")
    with pytest.raises(IntegrityError):
        with engine.begin() as c:
            c.execute(text("INSERT INTO loan_pix_accounts(user_id,label,holder_name,city,key_type,key,is_default,is_active,created_at,updated_at)"
                           " VALUES (:u,'x','x','x','email','b@b.co',true,true,now(),now())"), {"u": uid})


def test_db_rejects_loan_with_borrower_of_other_user(client, a, b):
    bid = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a).json()["id"]
    uid_b = _uid("bob@example.test")
    with pytest.raises(IntegrityError):
        with engine.begin() as c:
            c.execute(text(
                "INSERT INTO loans(user_id,borrower_id,principal_cents,interest_method,rate,rate_unit,installment_count,"
                "frequency,start_on,first_due_on,terms_hash,status,current_version,created_at,updated_at) VALUES "
                "(:u,:b,100,'price',1,'monthly_effective',1,'monthly','2026-01-01','2026-02-01','h','DRAFT',1,now(),now())"),
                {"u": uid_b, "b": bid})


def test_db_rejects_all_modules_disabled(client, a):
    uid = _uid("alice@example.test")
    with pytest.raises(IntegrityError):
        with engine.begin() as c:
            c.execute(text("UPDATE user_module_preferences SET cards_enabled=false, loans_enabled=false WHERE user_id=:u"), {"u": uid})


def test_concurrent_default_switch_leaves_single_default(client, a):
    ids = [client.post("/loans/pix-accounts", json={**PIX, "key": f"k{i}@x.co"}, headers=a).json()["id"] for i in range(4)]
    errors = []

    def hit(pid):
        for _ in range(5):
            r = client.post(f"/loans/pix-accounts/{pid}/default", headers=a)
            if r.status_code != 200:
                errors.append(r.status_code)

    ts = [threading.Thread(target=hit, args=(p,)) for p in ids]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert errors == []
    accts = client.get("/loans/pix-accounts", headers=a).json()
    assert sum(x["is_default"] for x in accts) == 1
