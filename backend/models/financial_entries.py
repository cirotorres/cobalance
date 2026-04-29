from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Date, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from db.database import Base


class FinancialEntry(Base):
    __tablename__ = "financial_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    transaction_date = Column(Date, nullable=False)
    description = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False)
    is_reviewed = Column(Boolean, default=False, nullable=False)
    installment_number = Column(Integer, nullable=False)
    installment_total = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(), onupdate=lambda: datetime.now(), nullable=False)
    
    user = relationship("User", back_populates="financial_entries")
    participant = relationship("Participant", back_populates="financial_entries")