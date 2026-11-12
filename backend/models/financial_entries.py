from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from db.database import Base


class FinancialEntry(Base):
    __tablename__ = "financial_entries"
    __table_args__ = (
        Index("idx_financial_date", "transaction_date"),
        Index("idx_financial_participant", "participant_id"),
        Index("idx_financial_user", "user_id"),
    )

    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", name="fk_financial_user", ondelete="CASCADE"), nullable=False)
    participant_id = Column(BigInteger, ForeignKey("participants.id", name="fk_financial_participant", ondelete="SET NULL"), nullable=True)
    batch_id = Column(Integer, ForeignKey("financial_entry_batches.id", name="fk_financial_entries_batch_id"), nullable=True, index=True)
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
    batch = relationship("FinancialEntryBatch", back_populates="entries")
