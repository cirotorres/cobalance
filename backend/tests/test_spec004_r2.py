"""SPEC004 R2: regressões da revisão independente F1 e F3.

F1 é testada com subprocesso falso, sem conexão a URL externa.
"""
from types import SimpleNamespace

import pytest
import test_p1_migration as migration_runner


FAKE_INHERITED = "postgresql://fake:fake@invalid.example/never_migrate"


def test_f1_alembic_subprocess_overrides_priority_inherited_url(monkeypatch):
    captured = []
    monkeypatch.setenv("COBALANCE_ALEMBIC_DATABASE_URL", FAKE_INHERITED)
    monkeypatch.setenv("COBALANCE_ALEMBIC_URL", FAKE_INHERITED)

    def fake_run(argv, **kwargs):
        captured.append((argv, kwargs))
        return SimpleNamespace(returncode=0, stdout="safe fake", stderr="")

    monkeypatch.setattr(migration_runner.subprocess, "run", fake_run)
    migration_runner._alembic("current")
    assert len(captured) == 1
    argv, options = captured[0]
    assert argv == ["uv", "run", "alembic", "current"]
    assert options["env"]["COBALANCE_ALEMBIC_DATABASE_URL"] == migration_runner.MIGR_URL
    assert options["env"]["COBALANCE_ALEMBIC_URL"] == migration_runner.MIGR_URL
    assert options["env"]["DATABASE_URL"] == migration_runner.MIGR_URL


def test_f1_alembic_rejects_non_disposable_target_before_subprocess(monkeypatch):
    calls = []
    monkeypatch.setattr(migration_runner, "MIGR_URL", FAKE_INHERITED)
    monkeypatch.setattr(migration_runner.subprocess, "run", lambda *a, **kw: calls.append(kw))
    with pytest.raises((RuntimeError, AssertionError)):
        migration_runner._alembic("upgrade", "head")
    assert calls == []


def test_f1_spec004_failed_downgrade_uses_same_safe_runner(monkeypatch):
    monkeypatch.setenv("COBALANCE_ALEMBIC_DATABASE_URL", FAKE_INHERITED)
    from test_p1_migration import _run_alembic
    calls = []
    def fake_run(argv, **kwargs):
        calls.append(kwargs["env"])
        return SimpleNamespace(returncode=1, stdout="", stderr="Downgrade bloqueado")
    monkeypatch.setattr(migration_runner.subprocess, "run", fake_run)
    result = _run_alembic("downgrade", "spec003_0001")
    assert result.returncode != 0
    assert len(calls) == 1
    assert calls[0]["COBALANCE_ALEMBIC_DATABASE_URL"] == migration_runner.MIGR_URL
    assert calls[0]["COBALANCE_ALEMBIC_URL"] == migration_runner.MIGR_URL
    assert calls[0]["DATABASE_URL"] == migration_runner.MIGR_URL


@pytest.mark.parametrize("frequency,interval", [
    ("monthly", None),
    ("biweekly", None),
    ("every_x_days", 365),
])
def test_f3_year_9999_overflow_is_422_not_internal_error(client, a, frequency, interval):
    body = {
        "principal": "1000.00", "interest_method": "fixed_addon", "rate": "0",
        "installment_count": 120, "frequency": frequency,
        "start_on": "9999-01-01", "first_due_on": "9999-02-01",
    }
    if interval is not None:
        body["interval_days"] = interval
    response = client.post("/loans/simulate", headers=a, json=body)
    assert response.status_code == 422, response.text
    assert "vencimento" in response.text.lower() or "calend" in response.text.lower()


def test_f3_end_of_supported_calendar_n1_still_allowed(client, a):
    response = client.post("/loans/simulate", headers=a, json={
        "principal": "1000.00", "interest_method": "fixed_addon", "rate": "0",
        "installment_count": 1, "frequency": "monthly",
        "start_on": "9999-01-01", "first_due_on": "9999-12-31",
    })
    assert response.status_code == 200, response.text
    assert response.json()["installments"][0]["due_on"] == "9999-12-31"
