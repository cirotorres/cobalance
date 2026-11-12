"""SPEC004 — cadeia Alembic exclusivamente no banco cobalance_spec003_migr_test (tmpfs)."""
from sqlalchemy import inspect, text
from test_p1_migration import migr_engine, _alembic, _run_alembic


def test_spec004_upgrade_existing_contract_downgrade_and_check(migr_engine):
    _alembic("upgrade", "spec003_0001")
    assert "voided_at" not in {c["name"] for c in inspect(migr_engine).get_columns("loans")}
    with migr_engine.begin() as conn:
        user_id = conn.execute(text("SELECT id FROM users WHERE email='x@t'")).scalar_one()
        borrower_id = conn.execute(text("""
            INSERT INTO loan_borrowers (user_id,name,name_normalized,created_at,updated_at)
            VALUES (:u,'Fictício','fictício',now(),now()) RETURNING id
        """), {"u": user_id}).scalar_one()
        loan_id = conn.execute(text("""
            INSERT INTO loans (user_id,borrower_id,principal_cents,interest_method,rate,rate_unit,
                installment_count,frequency,start_on,first_due_on,terms_hash,status,current_version,created_at,updated_at)
            VALUES (:u,:b,100000,'fixed_addon',0,'per_installment_on_principal',
                1,'monthly','2026-11-09','2026-12-10',:hash,'DRAFT',1,now(),now())
            RETURNING id
        """), {"u": user_id, "b": borrower_id, "hash": "1"*64}).scalar_one()

    _alembic("upgrade", "spec004_0001")
    cols = {x["name"] for x in inspect(migr_engine).get_columns("loans")}
    assert {"voided_at", "void_reason"} <= cols
    with migr_engine.connect() as conn:
        row = conn.execute(text("SELECT status, principal_cents FROM loans WHERE id=:i"), {"i": loan_id}).one()
        assert row == ("DRAFT", 100000)
    # Autogenerate NÃO deve pedir mudança após upgrade.
    report = _alembic("check")
    assert "No new upgrade operations detected" in (report.stdout + report.stderr)

    _alembic("downgrade", "spec003_0001")
    assert "voided_at" not in {x["name"] for x in inspect(migr_engine).get_columns("loans")}
    with migr_engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM loans WHERE id=:i"), {"i": loan_id}).scalar_one() == 1
    _alembic("upgrade", "spec004_0001")

    with migr_engine.begin() as conn:
        conn.execute(text("""
            UPDATE loans SET status='VOIDED', voided_at=now(), void_reason='Cadastro errado'
            WHERE id=:i
        """), {"i": loan_id})
    # Importante: não eliminar auditoria para fazer downgrade.
    r = _run_alembic("downgrade", "spec003_0001")
    assert r.returncode != 0
    assert "Downgrade bloqueado" in (r.stdout + r.stderr)
    with migr_engine.connect() as conn:
        assert conn.execute(text("SELECT status FROM loans WHERE id=:i"), {"i": loan_id}).scalar_one() == "VOIDED"
