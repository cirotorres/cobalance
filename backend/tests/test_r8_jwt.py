"""SPEC003-R8 JWT: tipo, expiração, identidade e compatibilidade.

Todos os casos de API usam o PostgreSQL descartável protegido pelo conftest.
"""
from datetime import datetime, timedelta, timezone
import os
import subprocess
import sys

import jwt
import pytest

from core import security
from core.config import ALGORITHM, SECRET_KEY


def _claims(token):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})


def _signed(**changes):
    claims = {
        "sub": "alice@example.test",
        "id": 1,
        "token_type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    claims.update(changes)
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


def _me(client, token):
    return client.get("/auth/me", headers={"Authorization": "Bearer " + token})


def _refresh(client, token):
    return client.post("/auth/refresh", json={"refresh_token": token})


def test_login_and_refresh_24h_30d_typed_tokens(client, a):
    before = datetime.now(timezone.utc).timestamp()
    response = client.post("/auth/login", json={"email": "alice@example.test", "password": "senha-teste-123"})
    assert response.status_code == 200
    pair = response.json()
    assert set(pair) == {"access_token", "refresh_token", "token_type"}
    assert pair["token_type"] == "Bearer"
    access = _claims(pair["access_token"])
    refresh = _claims(pair["refresh_token"])
    for payload, kind, seconds in [(access, "access", 24 * 3600), (refresh, "refresh", 30 * 86400)]:
        assert payload["token_type"] == kind
        assert payload["sub"] == "alice@example.test"
        assert payload["id"] == 1
        assert before + seconds - 1 <= payload["exp"] <= datetime.now(timezone.utc).timestamp() + seconds + 1
        assert payload["exp"] - payload["iat"] == seconds
    assert _me(client, pair["access_token"]).status_code == 200
    renewal = _refresh(client, pair["refresh_token"])
    assert renewal.status_code == 200
    assert set(renewal.json()) == {"access_token"}  # não rotaciona ou prorroga refresh
    renewed = _claims(renewal.json()["access_token"])
    assert renewed["token_type"] == "access"
    assert renewed["id"] == access["id"]
    assert renewed["sub"] == access["sub"]
    assert renewed["exp"] - renewed["iat"] == 24 * 3600
    assert _me(client, renewal.json()["access_token"]).status_code == 200
    assert _refresh(client, renewal.json()["access_token"]).status_code == 401


@pytest.mark.parametrize("mutation", [
    {"token_type": None},
    {"token_type": "invalid"},
    {"sub": None},
    {"id": None},
    {"id": 99999},
    {"sub": "other@example.test"},
    {"id": "1"},
    {"exp": datetime(2000, 1, 1, tzinfo=timezone.utc)},
])
def test_access_rejects_bad_claims_with_401(client, a, mutation):
    raw = {"sub": "alice@example.test", "id": 1, "token_type": "access",
           "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}
    raw.update(mutation)
    if mutation.get("token_type") is None:
        raw.pop("token_type", None)
    if mutation.get("sub") is None:
        raw.pop("sub", None)
    if mutation.get("id") is None:
        raw.pop("id", None)
    assert _me(client, jwt.encode(raw, SECRET_KEY, algorithm=ALGORITHM)).status_code == 401


@pytest.mark.parametrize("mutation", [
    {"token_type": None},
    {"token_type": "invalid"},
    {"token_type": "access"},
    {"sub": None},
    {"id": None},
    {"id": 99999},
    {"sub": "other@example.test"},
    {"id": "1"},
    {"exp": datetime(2000, 1, 1, tzinfo=timezone.utc)},
])
def test_refresh_rejects_bad_claims_with_401(client, a, mutation):
    raw = {"sub": "alice@example.test", "id": 1, "token_type": "refresh",
           "exp": datetime.now(timezone.utc) + timedelta(days=1)}
    raw.update(mutation)
    for name in ("token_type", "sub", "id"):
        if mutation.get(name, 1) is None:
            raw.pop(name, None)
    assert _refresh(client, jwt.encode(raw, SECRET_KEY, algorithm=ALGORITHM)).status_code == 401


def test_invalid_signatures_and_malformed_tokens_are_401(client, a):
    for token in ("not.a.jwt", "garbage", "", jwt.encode(
        {"sub": "alice@example.test", "id": 1, "token_type": "refresh",
         "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        "different-test-signature-key-32-bytes", algorithm=ALGORITHM
    )):
        assert _refresh(client, token).status_code == 401
        assert _me(client, token).status_code == 401


def test_expiry_boundary_without_sleeping(client, a):
    now = datetime.now(timezone.utc)
    near = _signed(exp=now + timedelta(seconds=10))
    expired = _signed(exp=now - timedelta(seconds=1))
    assert _me(client, near).status_code == 200
    assert _me(client, expired).status_code == 401
    assert _refresh(client, _signed(token_type="refresh", exp=now + timedelta(seconds=10))).status_code == 200
    assert _refresh(client, _signed(token_type="refresh", exp=now - timedelta(seconds=1))).status_code == 401


def test_access_token_valid_on_cards_and_loans(client, a):
    token = a["Authorization"].split(" ", 1)[1]
    assert client.get("/auth/me", headers=a).status_code == 200
    assert client.get("/participants/self", headers=a).status_code == 200
    assert client.get("/modules/me", headers=a).status_code == 200
    assert client.get("/loans/borrowers", headers=a).status_code == 200
    rt = client.post("/auth/login", json={"email": "alice@example.test", "password": "senha-teste-123"}).json()["refresh_token"]
    new_token = _refresh(client, rt).json()["access_token"]
    assert new_token
    for endpoint in ("/auth/me", "/participants/self", "/modules/me", "/loans/borrowers"):
        assert client.get(endpoint, headers={"Authorization": "Bearer " + new_token}).status_code == 200
    assert _refresh(client, token).status_code == 401


def test_explicit_config_overrides_take_precedence():
    env = os.environ.copy()
    env.update({"ACCESS_TOKEN_EXPIRE_MINUTES": "17", "REFRESH_TOKEN_EXPIRE_DAYS": "12"})
    proc = subprocess.run(
        [sys.executable, "-c", "from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS; print(ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS)"],
        env=env, capture_output=True, text=True, check=True,
    )
    assert proc.stdout.strip() == "17 12"


def test_creation_overwrites_caller_supplied_token_type():
    data = {"sub": "alice@example.test", "id": 1, "token_type": "refresh"}
    access = _claims(security.create_access_token(data))
    assert access["token_type"] == "access"
    refresh = _claims(security.create_refresh_token({**data, "token_type": "access"}))
    assert refresh["token_type"] == "refresh"
