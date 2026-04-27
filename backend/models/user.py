from sqlalchemy import Column, Integer, String, Boolean
from db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    password = Column(String)
    is_admin = Column(Boolean)
    age = Column(Integer, nullable=True)


