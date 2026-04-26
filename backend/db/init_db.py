from models.user import User
from models.favorite import Favorite
from db.database import engine, Base

def create_db_and_tables():
    Base.metadata.create_all(engine)