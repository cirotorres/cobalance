# from sqlmodel import create_engine, Session

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

# Base (modelos)
Base = declarative_base()

# Sessão
# Session = sessionmaker(engine)

Session = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_session():
    db = Session()
    try:
        yield db
    finally:
        db.close()


