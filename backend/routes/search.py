from fastapi import APIRouter
from services.external_api import get_item

router = APIRouter()

@router.get("/")
def search_movies():
    response = get_item()
    return response

