from sqlalchemy import BigInteger, Column, String, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", name="fk_participant_user", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String(7), nullable=True)

    user = relationship("User", back_populates="participants")
    financial_entries = relationship("FinancialEntry", back_populates="participant")

