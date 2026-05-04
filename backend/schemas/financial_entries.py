from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

class FinancialEntryCreate(BaseModel):
    # user_id: int
    participant_id: int | None = None
    amount: Decimal
    transaction_date: date
    description: str
    source: str
    is_reviewed: bool = False
    installment_number: int = 1 
    installment_total: int = 1

class FinancialEntryResponse(BaseModel):
    id: int
    user_id: int
    participant_id: int | None
    amount: Decimal
    transaction_date: date
    description: str
    source: str
    is_reviewed: bool
    installment_number: int | None
    installment_total: int | None
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: datetime = Field(default_factory=lambda: datetime.now())

    model_config = ConfigDict(from_attributes=True)

class TransactionUpdate(BaseModel):
    participant_id: int | None = None
    is_reviewed: bool | None = None

class FinancialEntryUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    source: Optional[str] = None
    is_reviewed: Optional[bool] = None