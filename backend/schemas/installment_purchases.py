"""Contrato estrito de compra total parcelada (SPEC001)."""

import re
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_validator, model_validator

from schemas.financial_entries import FinancialEntryResponse

_AMOUNT_RE = re.compile(r"[0-9]{1,8}(?:\.[0-9]{1,2})?\Z", re.ASCII)
_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\Z", re.ASCII)
MAX_CENTS = 9_999_999_999  # Numeric(10,2)
MAX_AMOUNT_LENGTH = 11  # 8 dígitos inteiros + ponto + 2 casas decimais


class InstallmentPurchaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    participant_id: StrictInt = Field(gt=0)
    amount: StrictStr
    transaction_date: date
    description: StrictStr
    source: Literal["credito", "debito", "pix"]
    installment_total: StrictInt = Field(default=1, ge=1, le=36)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: str) -> str:
        if len(value) > MAX_AMOUNT_LENGTH or not _AMOUNT_RE.fullmatch(value):
            raise ValueError("amount deve ser string decimal com até duas casas")
        cents = int(Decimal(value) * 100)
        if not 1 <= cents <= MAX_CENTS:
            raise ValueError("amount fora de Numeric(10,2) ou não positivo")
        return value

    @field_validator("transaction_date", mode="before")
    @classmethod
    def validate_iso_date(cls, value: object) -> date:
        if not isinstance(value, str) or not _DATE_RE.fullmatch(value):
            raise ValueError("transaction_date deve usar YYYY-MM-DD")
        try:
            return date.fromisoformat(value)
        except ValueError as error:
            raise ValueError("transaction_date inválida") from error

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        value = value.strip()
        if not 1 <= len(value) <= 255:
            raise ValueError("description deve ter de 1 a 255 caracteres")
        return value

    @model_validator(mode="after")
    def validate_purchase(self):
        if self.amount_cents < self.installment_total:
            raise ValueError("amount insuficiente para parcelas positivas")
        if self.installment_total > 1 and self.source != "credito":
            raise ValueError("parcelamento exige source credito")
        month_index = (self.transaction_date.year - 1) * 12 + (self.transaction_date.month - 1)
        if month_index + self.installment_total - 1 >= 9999 * 12:
            raise ValueError("parcelas extrapolam o calendário suportado")
        return self

    @property
    def amount_cents(self) -> int:
        return int(Decimal(self.amount) * 100)


class InstallmentPurchaseResponse(BaseModel):
    batch_id: int
    total_amount: Decimal
    installment_total: int
    entries: list[FinancialEntryResponse]
