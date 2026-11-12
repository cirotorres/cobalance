"""SPEC003 — motores financeiros puros (sem I/O). Decimal + centavos inteiros.

Convenções (documentadas no relatório R2):
- Arredondamento monetário: ROUND_HALF_UP para centavo, aplicado em cada
  componente gravado (juros do período / adicional por parcela). Cálculo
  intermediário com 50 dígitos de precisão.
- Motor A (fixed_addon): J = round(P * r); principal P dividido em n cotas,
  resto de centavos às primeiras parcelas.
- Motor B (price): taxa efetiva MENSAL. Frequência mensal → i por período = i_m
  (fórmula clássica). Demais → i_Δ = (1+i_m)^(Δdias/30) − 1, Δ contado desde
  `start_on` (1º período) ou vencimento anterior. Prestação constante
  A = P / Σ_k Π_{j≤k} (1+i_j)^-1, arredondada; juros = round(saldo * i_k);
  última parcela absorve o resíduo (principal = saldo remanescente) → saldo 0.
"""
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, localcontext

from loans.money import MAX_INSTALLMENTS, MAX_INTERVAL_DAYS, round_cents

PREC = 50


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Row:
    number: int
    due_on: date
    principal: int
    interest: int

    @property
    def total(self) -> int:
        return self.principal + self.interest


# ------------------------------------------------------------------ calendário
def add_months(d: date, k: int, anchor_day: int) -> date:
    m = d.month - 1 + k
    y, m = d.year + m // 12, m % 12 + 1
    return date(y, m, min(anchor_day, monthrange(y, m)[1]))


def due_dates(frequency: str, n: int, first_due_on: date | None, *, interval_days: int | None = None,
              manual_dates: list[date] | None = None) -> list[date]:
    if not 1 <= n <= MAX_INSTALLMENTS:
        raise ScheduleError(f"número de parcelas deve estar entre 1 e {MAX_INSTALLMENTS}")
    if frequency == "manual":
        ds = list(manual_dates or [])
        if len(ds) != n:
            raise ScheduleError("informe exatamente uma data por parcela")
        if any(b <= a for a, b in zip(ds, ds[1:])):
            raise ScheduleError("datas manuais devem ser estritamente crescentes")
        return ds
    if manual_dates:
        raise ScheduleError("datas manuais só são aceitas na frequência manual")
    if first_due_on is None:
        raise ScheduleError("primeiro vencimento obrigatório")
    if frequency == "monthly":
        return [add_months(first_due_on, k, first_due_on.day) for k in range(n)]
    if frequency == "biweekly":
        step = 15
    elif frequency == "every_x_days":
        if not interval_days or not 1 <= interval_days <= MAX_INTERVAL_DAYS:
            raise ScheduleError("intervalo em dias inválido")
        step = interval_days
    else:
        raise ScheduleError("frequência inválida")
    return [first_due_on + timedelta(days=step * k) for k in range(n)]


# ------------------------------------------------------------------ Motor A
def split_principal(p: int, n: int) -> list[int]:
    q, rem = divmod(p, n)
    if q == 0:
        raise ScheduleError("principal insuficiente para o número de parcelas")
    return [q + (1 if k < rem else 0) for k in range(n)]


def fixed_addon_schedule(principal_cents: int, rate_percent: Decimal, dates: list[date]) -> list[Row]:
    if principal_cents <= 0:
        raise ScheduleError("principal deve ser positivo")
    if rate_percent < 0:
        raise ScheduleError("taxa negativa")
    with localcontext() as ctx:
        ctx.prec = PREC
        j = round_cents(Decimal(principal_cents) * rate_percent / Decimal(100))
    parts = split_principal(principal_cents, len(dates))
    return [Row(k + 1, d, parts[k], j) for k, d in enumerate(dates)]


# ------------------------------------------------------------------ Motor B (Price)
def period_rates(monthly_rate_percent: Decimal, dates: list[date], *, start_on: date, frequency: str) -> list[Decimal]:
    if not dates or dates[0] <= start_on:
        raise ScheduleError("primeiro vencimento deve ser posterior à data de início")
    with localcontext() as ctx:
        ctx.prec = PREC
        im = Decimal(monthly_rate_percent) / Decimal(100)
        if frequency == "monthly":
            return [im] * len(dates)
        out, prev = [], start_on
        for d in dates:
            days = (d - prev).days
            if days <= 0:
                raise ScheduleError("datas devem ser crescentes")
            out.append((1 + im) ** (Decimal(days) / Decimal(30)) - 1 if im else Decimal(0))
            prev = d
        return out


def _amortize(balance: int, rates: list[Decimal], dates: list[date], payment: int, *, stop_when_zero: bool) -> list[Row]:
    rows: list[Row] = []
    with localcontext() as ctx:
        ctx.prec = PREC
        for k, (d, i) in enumerate(zip(dates, rates)):
            interest = round_cents(Decimal(balance) * i)
            last = k == len(dates) - 1
            principal = payment - interest
            if principal <= 0 and not last:
                raise ScheduleError("prestação não amortiza o saldo (juros do período ≥ prestação)")
            if last or principal >= balance:
                principal = balance
            rows.append(Row(k + 1, d, principal, interest))
            balance -= principal
            if balance == 0 and stop_when_zero:
                break
        if balance != 0:
            raise ScheduleError("saldo final diferente de zero")  # pragma: no cover - defensivo
    return rows


def price_schedule(principal_cents: int, monthly_rate_percent: Decimal, dates: list[date], *, start_on: date,
                   frequency: str) -> list[Row]:
    if principal_cents <= 0:
        raise ScheduleError("principal deve ser positivo")
    rates = period_rates(monthly_rate_percent, dates, start_on=start_on, frequency=frequency)
    n = len(dates)
    if all(r == 0 for r in rates):
        parts = split_principal(principal_cents, n)
        return [Row(k + 1, d, parts[k], 0) for k, d in enumerate(dates)]
    with localcontext() as ctx:
        ctx.prec = PREC
        acc, s = Decimal(1), Decimal(0)
        for r in rates:
            acc /= (1 + r)
            s += acc
        payment = round_cents(Decimal(principal_cents) / s)
    rows = _amortize(principal_cents, rates, dates, payment, stop_when_zero=False)
    if any(r.principal <= 0 for r in rows):
        raise ScheduleError("cronograma Price com parcela sem amortização")
    return rows


def price_reamortize(balance_cents: int, monthly_rate_percent: Decimal, dates: list[date], *, base_date: date,
                     frequency: str, strategy: str, current_installment_cents: int | None) -> list[Row]:
    """Recalcula o futuro após amortização extraordinária.

    reduce_installment (A1): mesmas datas futuras, nova prestação constante.
    reduce_term (A2): mesma prestação; consome as primeiras datas até zerar.
    `base_date` é o início do primeiro período futuro (vencimento anterior ou início).
    """
    if balance_cents <= 0:
        return []
    if strategy == "reduce_installment":
        return price_schedule(balance_cents, monthly_rate_percent, dates, start_on=base_date, frequency=frequency)
    if strategy != "reduce_term" or not current_installment_cents:
        raise ScheduleError("estratégia inválida")
    rates = period_rates(monthly_rate_percent, dates, start_on=base_date, frequency=frequency)
    rows = _amortize(balance_cents, rates, dates, current_installment_cents, stop_when_zero=True)
    return rows


# ------------------------------------------------------------------ alocação parcial
def allocate_proportional(amount: int, components: list[int]) -> list[int]:
    """Distribui `amount` proporcional aos saldos remanescentes dos componentes.

    Base = floor(amount*c/R); centavos restantes pelo maior resto; empate pela
    ordem dos componentes (principal → juros → ajuste). Nunca excede um saldo.
    """
    total = sum(components)
    if amount <= 0 or amount > total:
        raise ScheduleError("valor parcial deve ser > 0 e ≤ saldo da parcela")
    base = [amount * c // total for c in components]
    rema = [amount * c % total for c in components]
    left = amount - sum(base)
    order = sorted(range(len(components)), key=lambda k: (-rema[k], k))
    for k in order:
        if left == 0:
            break
        if base[k] < components[k]:
            base[k] += 1
            left -= 1
    assert left == 0 and all(b <= c for b, c in zip(base, components))
    return base
