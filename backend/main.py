from fastapi import FastAPI
from routes import favorites, auth, search
from db.init_db import create_db_and_tables

app = FastAPI()

# app.include_router(auth.router, prefix="/auth")
# app.include_router(favorites.router, prefix="/favorites")
app.include_router(search.router, prefix="/search")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()