import uvicorn
from fastapi import FastAPI
from routes import favorites, auth, search, users
# from db.init_db import create_db_and_tables
# from contextlib import asynccontextmanager
# import models.teste

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     create_db_and_tables()
#     yield

# app = FastAPI(lifespan=lifespan)
app = FastAPI()

app.include_router(auth.router, prefix="/auth")
app.include_router(search.router, prefix="/search")
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(favorites.router, prefix="/favorites", tags=["Favorites"])

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
