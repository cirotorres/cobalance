from sqlmodel import SQLModel
from db.session import engine
from models.user import User
# from models.favorite import Favorite

# from db.base import Base
# Base.metadata.create_all(engine)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)