from sqlmodel import SQLModel, create_engine, Session
from core.config import POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB


DATABASE_URL=f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@localhost:5433/{POSTGRES_DB}"

engine = create_engine(DATABASE_URL, echo=True)

def get_session():
    with Session(engine) as session:
        yield session