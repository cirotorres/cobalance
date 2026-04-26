# from sqlmodel import create_engine, Session

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PORT

# Engine
DB_URL =f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_engine(DB_URL, echo=True)


# Base (modelos)
Base = declarative_base()


# Sessão
Session = sessionmaker(engine)

def get_session():
    db = Session()
    try:
        yield db
    finally:
        db.close()


