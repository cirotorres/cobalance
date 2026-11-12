"""Registro durável de intenção e snapshot para idempotência."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from db.database import Base


class FinancialEntryBatch(Base):
    __tablename__ = "financial_entry_batches"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_financial_entry_batches_user_key"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    idempotency_key = Column(String(36), nullable=False)
    request_hash = Column(String(64), nullable=False)
    response_snapshot = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    entries = relationship("FinancialEntry", back_populates="batch")
