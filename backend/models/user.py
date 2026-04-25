# from sqlmodel import SQLModel, Field

# class User(SQLModel, table=True):
#     id: int | None = Field(default=None, primary_key=True)
#     email: str
#     password: str
#     is_admin: bool = False

# user1 = User(email="ciro@ciro", password="123")

from sqlalchemy import Column, Integer, String, Boolean
from db.base import Base

class User(Base):
    id = Column(Integer, primary_key=True)
    email = Column(String)
    password = Column(String)
    is_admin = Column(Boolean)
