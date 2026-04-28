from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean)
    age = Column(Integer, nullable=True)

    participants = relationship(
        "Participant",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    transactions = relationship("Transaction", back_populates="user")

