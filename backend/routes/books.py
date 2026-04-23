from fastapi import APIRouter
import requests

router = APIRouter()

@router.get("/")
def list_books():
    response = requests.get("https://jsonplaceholder.typicode.com/posts")
    return response.json()
