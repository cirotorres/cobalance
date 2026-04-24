from sqlmodel import SQLModel
from db.session import engine
from models.user import User
# from models.favorite import Favorite


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)