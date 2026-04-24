from fastapi import APIRouter
from services.external_api import get_item

router = APIRouter()

@router.get("/")
def search_movies(q: str = "Frankenstein"):
    response = get_item(q)
    return response

