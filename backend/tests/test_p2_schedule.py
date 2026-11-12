"""P2 / R2 — motores financeiros puros (sem banco). Oráculo independente via Fraction."""
from datetime import date
from decimal import Decimal
from fractions import Fraction

import pytest

from loans.money import MoneyError, cents_to_str, parse_money_to_cents, parse_rate
from loans.schedule import (
    ScheduleError, allocate_proportional, due_dates, fixed_addon_schedule, period_rates,
    price_reamortize, price_schedule,
)


# ------------------------------------------------------------------ dinheiro
@pytest.mark.parametrize("raw,cents", [("3000", 300000), ("3000.00", 300000), ("0.01", 1), ("1150.5", 115050)])
def test_parse_money_ok(raw, cents):
    assert parse_money_to_cents(raw) == cents


@pytest.mark.parametrize("raw", ["", "1,50", "1e3", "NaN", "-1", "1.001", "0", "0.00", " ", "inf", "100000001.00"])
def test_parse_money_rejects(raw):
    with pytest.raises(MoneyError):
        parse_money_to_cents(raw)


def test_parse_money_rejects_float():
    with pytest.raises(MoneyError):
        parse_money_to_cents(1.5)  # type: ignore[arg-type]


@pytest.mark.parametrize("raw", ["-1", "101", "1e1", "abc", "5,0", "1.0000001"])
def test_parse_rate_rejects(raw):
    with pytest.raises(MoneyError):
        parse_rate(raw)


def test_cents_to_str():
    assert cents_to_str(115000) == "1150.00" and cents_to_str(1) == "0.01" and cents_to_str(0) == "0.00"


# ------------------------------------------------------------------ calendário
def test_monthly_preserves_anchor_day_31_without_drift():
    d = due_dates("monthly", 5, date(2026, 1, 31))
    assert d == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30), date(2026, 5, 31)]


def test_monthly_leap_year():
    assert due_dates("monthly", 2, date(2028, 1, 30))[1] == date(2028, 2, 29)
    assert due_dates("monthly", 13, date(2027, 2, 28))[-1] == date(2028, 2, 28)  # âncora 28 mantida


def test_monthly_year_rollover():
    assert due_dates("monthly", 3, date(2026, 11, 30)) == [date(2026, 11, 30), date(2026, 12, 30), date(2027, 1, 30)]


def test_biweekly_and_every_x():
    assert due_dates("biweekly", 3, date(2026, 2, 20)) == [date(2026, 2, 20), date(2026, 3, 7), date(2026, 3, 22)]
    assert due_dates("every_x_days", 3, date(2026, 1, 1), interval_days=10) == [date(2026, 1, 1), date(2026, 1, 11), date(2026, 1, 21)]
    with pytest.raises(ScheduleError):
        due_dates("every_x_days", 3, date(2026, 1, 1))


def test_manual_dates_strictly_increasing_and_count():
    ds = [date(2026, 1, 5), date(2026, 1, 20), date(2026, 3, 1)]
    assert due_dates("manual", 3, None, manual_dates=ds) == ds
    with pytest.raises(ScheduleError):
        due_dates("manual", 3, None, manual_dates=[ds[0], ds[0], ds[2]])
    with pytest.raises(ScheduleError):
        due_dates("manual", 2, None, manual_dates=ds)


# ------------------------------------------------------------------ Motor A
def _sums(rows):
    return sum(r.principal for r in rows), sum(r.interest for r in rows), sum(r.principal + r.interest for r in rows)


def test_cleide_fixture():
    rows = fixed_addon_schedule(300000, Decimal("5"), due_dates("monthly", 3, date(2026, 12, 10)))
    assert [r.principal + r.interest for r in rows] == [115000] * 3
    assert _sums(rows) == (300000, 45000, 345000)


def test_livia_fixture():
    rows = fixed_addon_schedule(100000, Decimal("5"), due_dates("monthly", 4, date(2026, 12, 10)))
    assert [r.principal + r.interest for r in rows] == [30000] * 4
    assert _sums(rows) == (100000, 20000, 120000)


def test_addon_single_installment():
    rows = fixed_addon_schedule(300000, Decimal("5"), [date(2026, 12, 1)])
    assert [(r.principal, r.interest) for r in rows] == [(300000, 15000)]


def test_addon_cents_remainder_to_first_installments():
    rows = fixed_addon_schedule(100001, Decimal("5"), due_dates("monthly", 3, date(2026, 12, 1)))
    assert [r.principal for r in rows] == [33334, 33334, 33333]
    assert all(r.interest == 5000 for r in rows)  # round(1000.01*5%) = 50.0005 → 50.00
    assert _sums(rows)[0] == 100001


def test_addon_interest_rounding_half_up():
    # 0.10 * 5% = 0.005 → 0.01 (half-up), por parcela
    rows = fixed_addon_schedule(10, Decimal("5"), [date(2026, 1, 1)])
    assert rows[0].interest == 1


def test_addon_zero_rate_and_tiny_principal():
    rows = fixed_addon_schedule(2, Decimal("0"), due_dates("monthly", 2, date(2026, 1, 1)))
    assert [(r.principal, r.interest) for r in rows] == [(1, 0), (1, 0)]
    with pytest.raises(ScheduleError):  # R$0,01 em 3x: parcela de principal zero
        fixed_addon_schedule(1, Decimal("5"), due_dates("monthly", 3, date(2026, 1, 1)))


def test_addon_frequency_does_not_change_tariff():
    m = fixed_addon_schedule(300000, Decimal("5"), due_dates("monthly", 3, date(2026, 1, 1)))
    q = fixed_addon_schedule(300000, Decimal("5"), due_dates("biweekly", 3, date(2026, 1, 1)))
    assert [(r.principal, r.interest) for r in m] == [(r.principal, r.interest) for r in q]


# ------------------------------------------------------------------ Price — oráculo independente
def oracle_pmt(P_cents: int, i: Fraction, n: int) -> Fraction:
    if i == 0:
        return Fraction(P_cents, n)
    return Fraction(P_cents) * i / (1 - (1 + i) ** -n)


def oracle_round(x: Fraction) -> int:
    # half-up para valores positivos
    return int((x * 2 + 1) // 2)


@pytest.mark.parametrize("P,rate,n,expected_pmt", [
    (100000, "1", 12, 8885),       # tabela clássica: 1000 a 1% a.m. 12x = 88,85
    (1000000, "2", 6, 178526),     # 10000 a 2% 6x = 1785,26
    (300000, "5", 3, 110163),      # 3000 a 5% 3x
    (12345, "3.5", 7, None),
    (99999999, "9.99", 120, None),
])
def test_price_monthly_matches_oracle(P, rate, n, expected_pmt):
    dates = due_dates("monthly", n, date(2026, 1, 31))
    rows = price_schedule(P, Decimal(rate), dates, start_on=date(2025, 12, 31), frequency="monthly")
    i = Fraction(rate) / 100
    A = oracle_round(oracle_pmt(P, i, n))
    if expected_pmt:
        assert A == expected_pmt
    totals = [r.principal + r.interest for r in rows]
    assert totals[:-1] == [A] * (n - 1)
    if expected_pmt:  # faixas realistas: ajuste final pequeno
        assert abs(totals[-1] - A) <= n
    # oráculo independente: cronograma inteiro em aritmética racional exata
    obal, orows = P, []
    for k in range(n):
        oi = oracle_round(Fraction(obal) * i)
        op = obal if k == n - 1 else A - oi
        orows.append((op, oi))
        obal -= op
    assert [(r.principal, r.interest) for r in rows] == orows
    assert sum(r.principal for r in rows) == P
    assert all(r.principal >= 0 and r.interest >= 0 for r in rows)
    # juros de cada período = round(saldo * i) recomputado pelo oráculo
    bal = P
    for r in rows:
        assert r.interest == oracle_round(Fraction(bal) * i)
        bal -= r.principal
    assert bal == 0


def test_price_zero_rate_equals_division():
    rows = price_schedule(100000, Decimal("0"), due_dates("monthly", 3, date(2026, 1, 1)), start_on=date(2025, 12, 1), frequency="monthly")
    assert [(r.principal, r.interest) for r in rows] == [(33334, 0), (33333, 0), (33333, 0)]


def test_period_rates_biweekly_convention():
    dates = due_dates("biweekly", 2, date(2026, 1, 16))
    rates = period_rates(Decimal("3"), dates, start_on=date(2026, 1, 1), frequency="biweekly")
    expected = (Decimal("1.03") ** (Decimal(15) / Decimal(30))) - 1
    assert all(abs(r - expected) < Decimal("1e-25") for r in rates)


def test_price_irregular_converges_npv():
    start = date(2026, 1, 1)
    dates = [date(2026, 1, 20), date(2026, 3, 5), date(2026, 3, 20), date(2026, 6, 1)]
    P = 500000
    rows = price_schedule(P, Decimal("4"), dates, start_on=start, frequency="manual")
    assert sum(r.principal for r in rows) == P
    # PV dos fluxos (oráculo Fraction com fatores aproximados a 1e-12) ≈ P em até n centavos
    im = Decimal("0.04")
    pv, acc, prev = Decimal(0), Decimal(1), start
    for r, d in zip(rows, dates):
        acc *= (1 + im) ** (Decimal((d - prev).days) / Decimal(30))
        pv += Decimal(r.principal + r.interest) / acc
        prev = d
    assert abs(pv - P) <= len(rows)
    totals = [r.principal + r.interest for r in rows]
    assert len(set(totals[:-1])) == 1


def test_price_rejects_negative_amortization():
    # primeiro período enorme a taxa alta: juros > prestação → rejeitar
    with pytest.raises(ScheduleError):
        price_schedule(100000, Decimal("50"), [date(2027, 1, 1), date(2027, 1, 2)], start_on=date(2026, 1, 1), frequency="manual")


def test_first_due_must_be_after_start():
    with pytest.raises(ScheduleError):
        price_schedule(100000, Decimal("1"), [date(2026, 1, 1)], start_on=date(2026, 1, 1), frequency="manual")


# ------------------------------------------------------------------ parcial proporcional
@pytest.mark.parametrize("amount,comps,expected", [
    (57500, [100000, 15000, 0], [50000, 7500, 0]),   # metade de 1150 (Cleide)
    (1, [100000, 15000, 0], [1, 0, 0]),
    (115000, [100000, 15000, 0], [100000, 15000, 0]),
    (100, [1, 1, 1], None),                           # > saldo
    (2, [1, 1, 1], [1, 1, 0]),                        # empate → ordem principal, juros, ajuste
    (10, [33, 33, 34], [3, 3, 4]),
])
def test_allocate_proportional(amount, comps, expected):
    if expected is None:
        with pytest.raises(ScheduleError):
            allocate_proportional(amount, comps)
        return
    out = allocate_proportional(amount, comps)
    assert out == expected and sum(out) == amount and all(o <= c for o, c in zip(out, comps))


def test_allocate_property_random():
    import random
    rnd = random.Random(42)
    for _ in range(2000):
        comps = [rnd.randint(0, 10**6) for _ in range(3)]
        if sum(comps) == 0:
            continue
        amt = rnd.randint(1, sum(comps))
        out = allocate_proportional(amt, comps)
        assert sum(out) == amt and all(0 <= o <= c for o, c in zip(out, comps))


# ------------------------------------------------------------------ reamortização Price
def test_reamortize_reduce_installment_keeps_dates():
    dates = due_dates("monthly", 6, date(2026, 3, 10))
    rows = price_reamortize(400000, Decimal("2"), dates, base_date=date(2026, 2, 10), frequency="monthly",
                            strategy="reduce_installment", current_installment_cents=None)
    assert [r.due_on for r in rows] == dates
    assert sum(r.principal for r in rows) == 400000


def test_reamortize_reduce_term_keeps_installment():
    dates = due_dates("monthly", 6, date(2026, 3, 10))
    full = price_schedule(600000, Decimal("2"), dates, start_on=date(2026, 2, 10), frequency="monthly")
    A = full[0].principal + full[0].interest
    rows = price_reamortize(300000, Decimal("2"), dates, base_date=date(2026, 2, 10), frequency="monthly",
                            strategy="reduce_term", current_installment_cents=A)
    assert len(rows) < 6
    assert all(r.principal + r.interest == A for r in rows[:-1])
    assert rows[-1].principal + rows[-1].interest <= A
    assert sum(r.principal for r in rows) == 300000


def test_reamortize_reduce_term_rejects_installment_below_interest():
    with pytest.raises(ScheduleError):
        price_reamortize(1000000, Decimal("10"), due_dates("monthly", 3, date(2026, 2, 1)), base_date=date(2026, 1, 1),
                         frequency="monthly", strategy="reduce_term", current_installment_cents=100)
