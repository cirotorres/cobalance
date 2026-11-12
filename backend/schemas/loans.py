"""Schemas SPEC003 — extra=forbid; dinheiro/taxa como strings decimais."""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _clean(v):
    if v is None:
        return v
    v = v.strip()
    return v or None


class ModulePrefsPatch(Strict):
    cards_enabled: Optional[bool] = None
    loans_enabled: Optional[bool] = None
    default_module: Optional[Literal["cards", "loans"]] = None


class BorrowerCreate(Strict):
    name: str = Field(min_length=1, max_length=120)
    contact: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        v = " ".join(v.split())
        if not v:
            raise ValueError("nome obrigatório")
        return v

    @field_validator("contact", "note")
    @classmethod
    def _opt(cls, v):
        return _clean(v)


class BorrowerPatch(Strict):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    contact: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=500)
    archived: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        if v is None:
            return v
        v = " ".join(v.split())
        if not v:
            raise ValueError("nome obrigatório")
        return v


class PixCreate(Strict):
    label: str = Field(min_length=1, max_length=60)
    key: str = Field(max_length=77)
    holder_name: str = Field(min_length=1, max_length=60)
    city: str = Field(min_length=1, max_length=40)
    institution: Optional[str] = Field(default=None, max_length=60)

    @field_validator("label", "holder_name", "city")
    @classmethod
    def _nonblank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("obrigatório")
        return v


class PixPatch(Strict):
    label: Optional[str] = Field(default=None, min_length=1, max_length=60)
    holder_name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    city: Optional[str] = Field(default=None, min_length=1, max_length=40)
    institution: Optional[str] = Field(default=None, max_length=60)
    is_active: Optional[bool] = None


Frequency = Literal["monthly", "biweekly", "every_x_days", "manual"]
Method = Literal["fixed_addon", "price"]


class Terms(Strict):
    borrower_id: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=200)
    principal: str
    interest_method: Method
    rate: str
    installment_count: int = Field(ge=1, le=120)
    frequency: Frequency = "monthly"
    interval_days: Optional[int] = Field(default=None, ge=1, le=365)
    start_on: date
    first_due_on: Optional[date] = None
    manual_dates: Optional[list[date]] = Field(default=None, max_length=120)


class ContractCreate(Terms):
    borrower_id: int
    terms_hash: Optional[str] = Field(default=None, max_length=64)
    idempotency_key: str = Field(min_length=8, max_length=80)


class FundRequest(Strict):
    funded_on: date
    method: Literal["pix", "ted", "cash", "other"] = "pix"
    source: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=80)


class ReceiptItem(Strict):
    installment_id: int
    amount: Optional[str] = None


class ReceiptCreate(Strict):
    borrower_id: int
    received_on: date
    kind: Literal["full", "partial", "price_amortization"] = "full"
    amount: str
    items: list[ReceiptItem] = Field(default_factory=list, max_length=240)
    loan_id: Optional[int] = None
    strategy: Optional[Literal["reduce_installment", "reduce_term"]] = None
    method: Literal["pix", "ted", "cash", "other"] = "pix"
    pix_account_id: Optional[int] = None
    note: Optional[str] = Field(default=None, max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=80)


class ReverseRequest(Strict):
    reason: str = Field(min_length=3, max_length=300)


class PrepaymentPreview(Strict):
    amount: str
    strategy: Literal["reduce_installment", "reduce_term"]
    on: date


class AdjustmentCreate(Strict):
    amount: str
    reason: str = Field(min_length=3, max_length=300)
    idempotency_key: str = Field(min_length=8, max_length=80)


class ChargeCreate(Strict):
    borrower_id: int
    installment_ids: list[int] = Field(min_length=1, max_length=240)
    pix_account_id: Optional[int] = None
