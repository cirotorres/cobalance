from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)

    user = relationship("User", back_populates="participants")
    financial_entries = relationship("FinancialEntry", back_populates="participant")

