"""SPEC003 test harness — PostgreSQL DESCARTÁVEL obrigatório.

Recusa execução se a URL não for explicitamente de teste (host local,
nome de banco terminando em `_test`, flag COBALANCE_TEST_DB_DISPOSABLE=1).
Nunca usa DATABASE_URL/DATABASE_URL_LOCAL do .env.
"""
import os
import sys
from datetime import date
from urllib.parse import urlparse

TEST_URL = os.environ.get(
    "COBALANCE_TEST_DATABASE_URL",
    "postgresql://spec003_test:spec003_test@127.0.0.1:55439/cobalance_spec003_test",
)


def _assert_disposable(url: str) -> None:
    parsed = urlparse(url)
    if os.environ.get("COBALANCE_TEST_DB_DISPOSABLE") != "1":
        raise RuntimeError("Defina COBALANCE_TEST_DB_DISPOSABLE=1 para confirmar banco descartável.")
    if parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Banco de teste deve ser local.")
    if not (parsed.path or "").rstrip("/").endswith("_test"):
        raise RuntimeError("Nome do banco de teste deve terminar em _test.")
    if "neon" in url or "supabase" in url:
        raise RuntimeError("URL proibida.")


_assert_disposable(TEST_URL)
# Precisa ocorrer ANTES de importar db.database (engine criado no import).
os.environ["DATABASE_URL"] = TEST_URL
os.environ.setdefault("SECRET_KEY", "spec003-test-secret-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import core.config as _cfg  # noqa: E402

_cfg.DATABASE_URL = TEST_URL
from db.database import Base, engine  # noqa: E402
from main import app  # noqa: E402
import models.loans  # noqa: E402,F401
from loans import deps as loan_deps  # noqa: E402

assert str(engine.url).startswith("postgresql://spec003_test:"), "engine não aponta para o banco de teste"


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def _clean():
    names = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


class Clock:
    def __init__(self):
        self.today = date(2026, 11, 9)


@pytest.fixture
def clock():
    c = Clock()
    app.dependency_overrides[loan_deps.get_today] = lambda: c.today
    return c


@pytest.fixture
def client(clock):
    return TestClient(app)


def make_user(client, email, password="senha-teste-123", is_admin=False):
    r = client.post("/users/", json={"email": email, "name": email.split("@")[0], "password": password, "is_admin": is_admin})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def user_a(client):
    return make_user(client, "alice@example.test")


@pytest.fixture
def user_b(client):
    return make_user(client, "bob@example.test")


def enable_loans(client, headers):
    r = client.patch("/modules/me", json={"loans_enabled": True}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def a(client, user_a):
    enable_loans(client, user_a)
    return user_a


@pytest.fixture
def b(client, user_b):
    enable_loans(client, user_b)
    return user_b
