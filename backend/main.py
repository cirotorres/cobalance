from fastapi import FastAPI
from routes import favorites, auth, books

app = FastAPI()

# app.include_router(auth.router, prefix="/auth")
# app.include_router(favorites.router, prefix="/favorites")
app.include_router(books.router, prefix="/books")