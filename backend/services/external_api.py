import requests
from core.config import API_KEY, API_BASE_URL

def get_item():
    params = {
        "q": "dragon-ball",
        "type": "show",
        "limit": 3,
        "info": 1,
        "k": API_KEY
    }

    response = requests.get(API_BASE_URL, params=params)
    data = response.json()

    return data