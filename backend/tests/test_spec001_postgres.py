"""Integração REAL em PostgreSQL descartável. Nunca usar banco existente."""

import os
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from uuid import uuid4

# Permite importar o app mesmo quando só os testes unitários rodam.
# Não é usado para executar SQL nem migrações.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://unused@127.0.0.1:1/unused")
os.environ.setdefault("SECRET_KEY", "spec001-unit-only-dummy-secret-32-characters")
os.environ.setdefault("ALGORITHM", "HS256")

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker

from core.security import create_access_token
from db.database import get_session
from main import app
from models.financial_entries import FinancialEntry
from models.financial_entry_batches import FinancialEntryBatch
from models.participant import Participant
from models.user import User


def purchase(**changes):
    data = dict(participant_id=101, amount="300.01", transaction_date="2027-01-31",
                description=" LOJA ", source="credito", installment_total=3)
    data.update(changes)
    return data


class PostgreSQLSpec001(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ.get("COBALANCE_SPEC001_TEST_DATABASE_URL")
        if not url:
            raise unittest.SkipTest("PostgreSQL descartável indisponível: falta COBALANCE_SPEC001_TEST_DATABASE_URL")
        if os.environ.get("COBALANCE_ALEMBIC_DATABASE_URL") != url:
            raise RuntimeError("Recusado: Alembic não aponta ao mesmo banco temporário do teste")
        cls.engine = sa.create_engine(url, pool_pre_ping=True)
        with cls.engine.connect() as conn:
            database = conn.scalar(sa.text("SELECT current_database()"))
            if not database.startswith("cobalance_spec001_test_"):
                raise RuntimeError("Recusado: banco não é descartável SPEC001")
            if sa.inspect(conn).get_table_names():
                raise RuntimeError("Recusado: banco descartável já contém tabelas")

        # Schema legado reproduzido explicitamente, sem create_all do modelo novo.
        cls.legacy = sa.MetaData()
        sa.Table("users", cls.legacy,
                 sa.Column("id", sa.Integer, primary_key=True),
                 sa.Column("email", sa.String, unique=True),
                 sa.Column("name", sa.String, nullable=False),
                 sa.Column("password_hash", sa.String, nullable=False),
                 sa.Column("is_admin", sa.Boolean),
                 sa.Column("age", sa.Integer))
        sa.Table("participants", cls.legacy,
                 sa.Column("id", sa.Integer, primary_key=True),
                 sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
                 sa.Column("name", sa.String, nullable=False),
                 sa.Column("color", sa.String(7)))
        sa.Table("financial_entries", cls.legacy,
                 sa.Column("id", sa.Integer, primary_key=True),
                 sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
                 sa.Column("participant_id", sa.Integer, sa.ForeignKey("participants.id")),
                 sa.Column("amount", sa.Numeric(10, 2), nullable=False),
                 sa.Column("transaction_date", sa.Date, nullable=False),
                 sa.Column("description", sa.String(255), nullable=False),
                 sa.Column("source", sa.String(50), nullable=False),
                 sa.Column("is_reviewed", sa.Boolean, nullable=False),
                 sa.Column("installment_number", sa.Integer, nullable=False),
                 sa.Column("installment_total", sa.Integer, nullable=False),
                 sa.Column("created_at", sa.DateTime, nullable=False),
                 sa.Column("updated_at", sa.DateTime, nullable=False))
        cls.legacy.create_all(cls.engine)
        with cls.engine.begin() as c:
            c.execute(cls.legacy.tables["users"].insert(), [
                dict(id=11, email="first@spec001.test", name="Primeiro", password_hash="x", is_admin=False),
                dict(id=22, email="second@spec001.test", name="Segundo", password_hash="x", is_admin=False),
                dict(id=33, email="admin@spec001.test", name="Admin", password_hash="x", is_admin=True),
            ])
            c.execute(cls.legacy.tables["participants"].insert(), [
                dict(id=101, user_id=11, name="Primeiro"),
                dict(id=202, user_id=22, name="Segundo"),
                dict(id=303, user_id=33, name="Admin"),
            ])
            c.execute(cls.legacy.tables["financial_entries"].insert(), [dict(
                id=99, user_id=22, participant_id=202, amount=15,
                transaction_date=date(2026, 5, 1), description="LEGACY", source="credito",
                is_reviewed=False, installment_number=1, installment_total=1,
                created_at=datetime(2026, 5, 1), updated_at=datetime(2026, 5, 1),
            )])

        cls.alembic = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        command.upgrade(cls.alembic, "20261101_spec001")
        with cls.engine.connect() as c:
            assert c.scalar(sa.text("SELECT version_num FROM alembic_version")) == "20261101_spec001"
        cls.sessions = sessionmaker(cls.engine, autoflush=False)

        def isolated_session():
            with cls.sessions() as db:
                yield db

        app.dependency_overrides[get_session] = isolated_session
        cls.tokens = {
            11: create_access_token({"sub": "first@spec001.test", "id": 11}),
            22: create_access_token({"sub": "second@spec001.test", "id": 22}),
            33: create_access_token({"sub": "admin@spec001.test", "id": 33}),
        }

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        # Prova que downgrade não remove a linha histórica do legado.
        command.downgrade(cls.alembic, "base")
        inspector = sa.inspect(cls.engine)
        assert "financial_entry_batches" not in inspector.get_table_names()
        assert "batch_id" not in {col["name"] for col in inspector.get_columns("financial_entries")}
        with cls.engine.connect() as c:
            assert c.scalar(sa.text("SELECT count(*) FROM financial_entries WHERE id=99 AND description='LEGACY'")) == 1
        command.upgrade(cls.alembic, "20261101_spec001")
        command.downgrade(cls.alembic, "base")
        with cls.engine.connect() as c:
            assert c.scalar(sa.text("SELECT count(*) FROM financial_entries WHERE id=99 AND description='LEGACY'")) == 1
        cls.legacy.drop_all(cls.engine)
        cls.engine.dispose()

    def setUp(self):
        with self.sessions.begin() as db:
            db.query(FinancialEntry).filter(FinancialEntry.id != 99).delete(synchronize_session=False)
            db.query(FinancialEntryBatch).delete(synchronize_session=False)

    def headers(self, user=11, key=None):
        return {"Authorization": "Bearer " + self.tokens[user], "Idempotency-Key": key or str(uuid4())}

    def counts(self):
        with self.sessions() as db:
            return db.query(FinancialEntryBatch).count(), db.query(FinancialEntry).count() - 1

    def test_creation_exact_snapshot_and_single_installment(self):
        with TestClient(app) as client:
            res = client.post("/financial/installments", json=purchase(), headers=self.headers())
            self.assertEqual(res.status_code, 201, res.text)
            body = res.json()
            self.assertEqual(body["total_amount"], "300.01")
            self.assertEqual([e["amount"] for e in body["entries"]], ["100.01", "100.00", "100.00"])
            self.assertEqual([e["transaction_date"] for e in body["entries"]],
                             ["2027-01-31", "2027-02-28", "2027-03-31"])
            self.assertEqual([e["installment_number"] for e in body["entries"]], [1, 2, 3])
            self.assertEqual({e["user_id"] for e in body["entries"]}, {11})
            self.assertEqual({e["is_reviewed"] for e in body["entries"]}, {False})
            self.assertEqual(self.counts(), (1, 3))
            existing_list = client.get("/financial/financial-entries", headers=self.headers())
            self.assertEqual(existing_list.status_code, 200, existing_list.text)
            self.assertEqual(len(existing_list.json()), 3)
            single = client.post("/financial/installments", json=purchase(amount="0.01", installment_total=1,
                source="pix"), headers=self.headers())
            self.assertEqual(single.status_code, 201, single.text)
            self.assertEqual(len(single.json()["entries"]), 1)

    def test_retry_normalized_and_conflict(self):
        key = str(uuid4())
        with TestClient(app) as client:
            first = client.post("/financial/installments", json=purchase(amount="300.0"), headers=self.headers(key=key))
            again = client.post("/financial/installments", json=purchase(amount="300.00", description="LOJA"), headers=self.headers(key=key))
            self.assertEqual((first.status_code, again.status_code), (201, 200), (first.text, again.text))
            self.assertEqual(first.json(), again.json())
            wrong = client.post("/financial/installments", json=purchase(amount="300.01"), headers=self.headers(key=key))
            self.assertEqual(wrong.status_code, 409, wrong.text)
            self.assertEqual(self.counts(), (1, 3))
            with self.sessions() as db:
                stored = db.query(FinancialEntryBatch).one()
                self.assertEqual(stored.response_snapshot, first.json())
                entry = db.query(FinancialEntry).filter_by(batch_id=stored.id, installment_number=1).one()
                entry.description = "EDITADA DEPOIS"
                db.commit()
            snapshot_again = client.post("/financial/installments", json=purchase(amount="300.00"), headers=self.headers(key=key))
            self.assertEqual(snapshot_again.status_code, 200)
            self.assertEqual(snapshot_again.json(), first.json())

    def test_retry_after_participant_deleted_preserves_snapshot_and_scope(self):
        # Participante temporário próprio, para não interferir nos fixtures globais.
        with self.sessions.begin() as db:
            db.add(Participant(id=404, user_id=11, name="Removível"))
        data = purchase(participant_id=404)
        key = str(uuid4())
        with TestClient(app) as client:
            first = client.post("/financial/installments", json=data, headers=self.headers(key=key))
            self.assertEqual(first.status_code, 201, first.text)
            snapshot = first.json()

            # A relação ORM desvincula lançamentos existentes (FK nullable) na exclusão.
            # O batch/snapshot sobrevive mesmo após a remoção do participante.
            with self.sessions.begin() as db:
                db.delete(db.get(Participant, 404))
            with self.sessions() as db:
                entries = db.query(FinancialEntry).filter_by(batch_id=snapshot["batch_id"]).all()
                self.assertEqual(len(entries), 3)
                self.assertTrue(all(entry.participant_id is None for entry in entries))

            same = client.post("/financial/installments", json=data, headers=self.headers(key=key))
            changed = client.post("/financial/installments", json=purchase(participant_id=404, amount="300.02"),
                                  headers=self.headers(key=key))
            other_user = client.post("/financial/installments", json=data, headers=self.headers(user=22, key=key))
            self.assertEqual(same.status_code, 200, same.text)
            self.assertEqual(same.json(), snapshot)
            self.assertEqual(changed.status_code, 409, changed.text)
            self.assertEqual(other_user.status_code, 404, other_user.text)
            self.assertEqual(self.counts(), (1, 3))

    def test_auth_participant_and_get_owner_even_admin(self):
        with TestClient(app) as client:
            missing = client.post("/financial/installments", json=purchase(), headers={"Idempotency-Key": str(uuid4())})
            self.assertEqual(missing.status_code, 401, missing.text)
            denied = client.post("/financial/installments", json=purchase(participant_id=202), headers=self.headers())
            self.assertEqual(denied.status_code, 404, denied.text)
            admin_denied = client.post("/financial/installments", json=purchase(participant_id=101), headers=self.headers(user=33))
            self.assertEqual(admin_denied.status_code, 404, admin_denied.text)
            self.assertEqual(client.get("/financial/99").status_code, 401)
            self.assertEqual(client.get("/financial/99", headers=self.headers()).status_code, 404)
            self.assertEqual(client.get("/financial/99", headers=self.headers(user=33)).status_code, 404)
            self.assertEqual(client.get("/financial/99", headers=self.headers(user=22)).status_code, 200)
            self.assertEqual(self.counts(), (0, 0))

    def test_invalid_payload_or_header_never_writes(self):
        variants = [purchase(amount=1.2), purchase(amount="0"), purchase(amount="0.02"),
                    purchase(amount="300.001"), purchase(source="debito"),
                    purchase(installment_total=True), purchase(user_id=22),
                    purchase(transaction_date="2027-02-30")]
        with TestClient(app) as client:
            for data in variants:
                with self.subTest(data=data):
                    r = client.post("/financial/installments", json=data, headers=self.headers())
                    self.assertEqual(r.status_code, 422, r.text)
            self.assertEqual(client.post("/financial/installments", json=purchase(),
                                          headers=self.headers(key=str(uuid4()).replace("-", "")[:8])).status_code, 422)
            self.assertEqual(client.post("/financial/installments", json=purchase(),
                                          headers={"Authorization": "Bearer " + self.tokens[11]}).status_code, 422)
        self.assertEqual(self.counts(), (0, 0))

    def test_amount_very_long_returns_422_not_500(self):
        with TestClient(app, raise_server_exceptions=False) as client:
            huge = client.post("/financial/installments", json=purchase(amount="9" * 1_000_000),
                               headers=self.headers())
            self.assertEqual(huge.status_code, 422)
            too_many_integer_digits = client.post("/financial/installments", json=purchase(amount="100000000"),
                                                  headers=self.headers())
            self.assertEqual(too_many_integer_digits.status_code, 422)
            boundary = client.post("/financial/installments", json=purchase(amount="99999999.99", installment_total=1),
                                   headers=self.headers())
            self.assertEqual(boundary.status_code, 201, boundary.text)
            self.assertEqual(boundary.json()["total_amount"], "99999999.99")
        self.assertEqual(self.counts(), (1, 1))

    def test_unique_per_user_and_legacy_post(self):
        key = str(uuid4())
        with TestClient(app) as client:
            self.assertEqual(client.post("/financial/installments", json=purchase(), headers=self.headers(key=key)).status_code, 201)
            other = client.post("/financial/installments", json=purchase(participant_id=202), headers=self.headers(user=22, key=key))
            self.assertEqual(other.status_code, 201, other.text)
            legacy = client.post("/financial/", headers=self.headers(), json=dict(
                participant_id=101, amount="12.50", transaction_date="2026-11-01",
                description="COMPRA LEGADA", source="credito", installment_number=1, installment_total=1,
            ))
            self.assertEqual(legacy.status_code, 200, legacy.text)
            self.assertEqual(legacy.json()["amount"], "12.50")
            self.assertEqual(self.counts(), (2, 7))

    def test_other_legacy_routes_still_registered_and_protected(self):
        with TestClient(app) as client:
            self.assertEqual(client.post("/agente/", json={"text": "consulta"}).status_code, 401)
            self.assertEqual(client.post("/financial/import-csv", files={
                "file": ("sample.csv", "date,title,amount\n2026-01-01,A,1\n", "text/csv")
            }).status_code, 401)

    def test_rollback_when_last_entry_or_snapshot_fails(self):
        for failing in ("last_entry", "snapshot"):
            calls = {"entries": 0}

            def fail_on_sql(conn, cursor, statement, parameters, context, executemany):
                sql = statement.upper()
                if failing == "last_entry" and sql.startswith("INSERT INTO FINANCIAL_ENTRIES"):
                    calls["entries"] += 1
                    if calls["entries"] == 3:
                        raise RuntimeError("deliberate last-entry failure")
                if failing == "snapshot" and sql.startswith("UPDATE FINANCIAL_ENTRY_BATCHES"):
                    raise RuntimeError("deliberate snapshot failure")

            event.listen(self.engine, "before_cursor_execute", fail_on_sql)
            try:
                with TestClient(app, raise_server_exceptions=False) as client:
                    res = client.post("/financial/installments", json=purchase(), headers=self.headers())
                self.assertEqual(res.status_code, 500, (failing, res.text))
            finally:
                event.remove(self.engine, "before_cursor_execute", fail_on_sql)
            self.assertEqual(self.counts(), (0, 0), failing)

    def test_concurrent_same_and_different_intents(self):
        for different in (False, True):
            key = str(uuid4())
            barrier = threading.Barrier(2)

            def submit(index):
                body = purchase(amount="300.02" if different and index else "300.01")
                with TestClient(app) as client:
                    barrier.wait(timeout=10)
                    res = client.post("/financial/installments", json=body, headers=self.headers(key=key))
                return res.status_code, res.json()

            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(submit, range(2)))
            expected = [201, 409] if different else [200, 201]
            self.assertEqual(sorted(code for code, _ in results), expected, results)
            self.assertEqual(self.counts()[0], 1 if not different else 2)
            if not different:
                self.assertEqual(results[0][1], results[1][1])
            else:
                self.assertTrue(any(body.get("detail") for code, body in results if code == 409))


if __name__ == "__main__":
    unittest.main()
