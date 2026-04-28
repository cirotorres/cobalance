from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Date, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from db.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    transaction_date = Column(Date, nullable=False)
    description = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False)
    is_reviewed = Column(Boolean, default=False, nullable=False)
    installment_number = Column(Integer, nullable=True)
    installment_total = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime(timezone.utc), nullable=False)
    
    user = relationship("User", back_populates="transactions")
    participant = relationship("Participant", back_populates="transactions")