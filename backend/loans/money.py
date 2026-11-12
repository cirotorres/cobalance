"""Conversões monetárias: Decimal/centavos inteiros, nunca float."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re

MAX_PRINCIPAL_CENTS = 100_000_000_00  # R$ 100 milhões — limite conservador
MAX_RATE_PERCENT = Decimal("100")       # por período
MAX_INSTALLMENTS = 120
MAX_INTERVAL_DAYS = 365

_MONEY_RE = re.compile(r"^\d{1,12}(\.\d{1,2})?$")
_RATE_RE = re.compile(r"^\d{1,3}(\.\d{1,6})?$")


class MoneyError(ValueError):
    pass


def parse_money_to_cents(value: str, *, allow_zero: bool = False) -> int:
    """Aceita string decimal com ponto ("1150.00"). Rejeita float, NaN, exp, vírgula, sinal."""
    if not isinstance(value, str):
        raise MoneyError("valor monetário deve ser string decimal")
    v = value.strip()
    if not _MONEY_RE.match(v):
        raise MoneyError("formato monetário inválido (use 1234.56)")
    cents = int((Decimal(v) * 100).to_integral_exact())
    if cents < 0 or (cents == 0 and not allow_zero):
        raise MoneyError("valor deve ser positivo")
    if cents > MAX_PRINCIPAL_CENTS:
        raise MoneyError("valor acima do limite")
    return cents


def parse_rate(value: str) -> Decimal:
    if not isinstance(value, str):
        raise MoneyError("taxa deve ser string decimal")
    v = value.strip()
    if not _RATE_RE.match(v):
        raise MoneyError("formato de taxa inválido (use 5 ou 5.25)")
    try:
        r = Decimal(v)
    except InvalidOperation as e:  # pragma: no cover - regex já cobre
        raise MoneyError("taxa inválida") from e
    if r < 0 or r > MAX_RATE_PERCENT:
        raise MoneyError("taxa fora do limite (0–100%)")
    return r


def round_cents(value: Decimal) -> int:
    """Arredonda Decimal em centavos (já multiplicado) half-up para inteiro."""
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def cents_to_str(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    c = abs(int(cents))
    return f"{sign}{c // 100}.{c % 100:02d}"


def rate_to_str(rate: Decimal) -> str:
    s = format(Decimal(rate).normalize(), "f")
    return s
