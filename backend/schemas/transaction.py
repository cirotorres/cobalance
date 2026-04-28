from datetime import datetime, date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

class TransactionCreate(BaseModel):
    user_id: int
    participant_id: int | None = None
    amount: Decimal
    transaction_date: date
    description: str
    source: str
    is_reviewed: bool = False
    installment_number: int | None = None
    installment_total: int | None = None

class TransactionResponse(BaseModel):
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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TransactionUpdate(BaseModel):
    participant_id: int | None = None
    is_reviewed: bool | None = None