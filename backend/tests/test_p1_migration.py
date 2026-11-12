"""R1 — migration up/down somente em PostgreSQL descartável (banco *_migr_test)."""
import os
import subprocess
from urllib.parse import urlparse

import pytest
from sqlalchemy import (BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, MetaData,
                        Numeric, String, Table, create_engine, inspect, text)

from conftest import TEST_URL
from db.database import Base

MIGR_URL = TEST_URL.rsplit("/", 1)[0] + "/cobalance_spec003_migr_test"
BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_TABLES = {
    "user_module_preferences", "loan_borrowers", "loan_pix_accounts", "loans", "loan_schedule_versions",
    "loan_installments", "loan_receipts", "loan_receipt_allocations", "loan_adjustments", "loan_charges",
    "loan_charge_items", "loan_events", "loan_idempotency_keys",
}
LEGACY = ("users", "participants", "financial_entries")


def _safe_migration_url():
    """Rejeita alvo não descartável ANTES de chamar qualquer subprocesso Alembic.

    Não basta a flag de pytest: env.py dá prioridade a
    COBALANCE_ALEMBIC_DATABASE_URL, que pode ter sido herdada do shell.
    """
    db = urlparse(MIGR_URL)
    source = urlparse(TEST_URL)
    if (
        os.environ.get("COBALANCE_TEST_DB_DISPOSABLE") != "1"
        or db.scheme not in {"postgresql", "postgresql+psycopg2"}
        or db.hostname not in {"127.0.0.1", "localhost"}
        or db.path != "/cobalance_spec003_migr_test"
        or source.hostname not in {"127.0.0.1", "localhost"}
        or not source.path.endswith("_test")
        or db.port != 55439
        or source.port != 55439
        or db.username != source.username
        or db.password != source.password
    ):
        raise RuntimeError("Alembic de testes recusado: alvo não identificado como PostgreSQL descartável.")
    return MIGR_URL


def _run_alembic(*args):
    """Runner compartilhado inclusive pelo downgrade esperado como falha da SPEC004."""
    url = _safe_migration_url()
    env = {
        **os.environ,
        "COBALANCE_ALEMBIC_DATABASE_URL": url,  # prioridade máxima em alembic/env.py
        "COBALANCE_ALEMBIC_URL": url,
        "DATABASE_URL": url,
    }
    return subprocess.run(["uv", "run", "alembic", *args], cwd=BACKEND, env=env,
                          capture_output=True, text=True)


def _alembic(*args):
    result = _run_alembic(*args)
    assert result.returncode == 0, result.stderr[-2000:]
    return result


def create_legacy_schema(eng):
    """Reproduz apenas o esquema anterior à SPEC001, sem o batch_id da ORM integrada.

    A SPEC001 deve criar financial_entry_batches e acrescentar batch_id. Construir
    financial_entries a partir da ORM atual criaria FK prematura. Representamos
    o schema legado real do Neon (BIGINT, índices e FKs ON DELETE), sem tocar
    em qualquer banco não descartável.
    """
    metadata = MetaData()
    Base.metadata.tables["users"].to_metadata(metadata)
    Base.metadata.tables["participants"].to_metadata(metadata)
    Table(
        "financial_entries", metadata,
        Column("id", BigInteger, primary_key=True),
        Column("user_id", BigInteger, ForeignKey("users.id", name="fk_financial_user", ondelete="CASCADE"), nullable=False),
        Column("participant_id", BigInteger, ForeignKey("participants.id", name="fk_financial_participant", ondelete="SET NULL")),
        Column("amount", Numeric(10, 2), nullable=False),
        Column("transaction_date", Date, nullable=False),
        Column("description", String(255), nullable=False),
        Column("source", String(50), nullable=False),
        Column("is_reviewed", Boolean, nullable=False),
        Column("installment_number", Integer, nullable=False),
        Column("installment_total", Integer, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Index("idx_financial_date", "transaction_date"),
        Index("idx_financial_participant", "participant_id"),
        Index("idx_financial_user", "user_id"),
    )
    metadata.create_all(eng)


@pytest.fixture
def migr_engine():
    _safe_migration_url()  # guard ANTES de DROP/CREATE DATABASE do ensaio
    admin = create_engine(TEST_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text("DROP DATABASE IF EXISTS cobalance_spec003_migr_test"))
        c.execute(text("CREATE DATABASE cobalance_spec003_migr_test"))
    admin.dispose()
    eng = create_engine(MIGR_URL)
    create_legacy_schema(eng)
    with eng.begin() as c:
        c.execute(text("INSERT INTO users(email,name,password_hash,is_admin) VALUES ('x@t','x','h',false)"))
    yield eng
    eng.dispose()


def test_upgrade_downgrade_roundtrip(migr_engine):
    _alembic("upgrade", "head")
    tables = set(inspect(migr_engine).get_table_names())
    assert NEW_TABLES <= tables
    # schema migrado == metadata ORM (autogenerate não detecta diferenças)
    r = _alembic("check")
    assert "No new upgrade operations detected" in (r.stdout + r.stderr)
    _alembic("downgrade", "20261101_spec001")
    tables = set(inspect(migr_engine).get_table_names())
    assert not (NEW_TABLES & tables)
    assert set(LEGACY) <= tables
    with migr_engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM users")).scalar() == 1
    _alembic("upgrade", "head")  # reaplicável
