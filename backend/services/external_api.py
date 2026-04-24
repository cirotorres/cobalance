import requests
from core.config import API_KEY, API_BASE_URL

def get_item(query: str):
    params = {
        "q": query,
        "type": "movie",
        "limit": 3,
        "info": 1,
        "k": API_KEY
    }

    response = requests.get(API_BASE_URL, params=params)
    data = response.json()

    return [    
        {
            "name": item.get("name"),
            "yID": item.get("yID"),
            "description": item.get("description"),
            "wUrl": item.get("wUrl"),
            "yUrl": item.get("yUrl")
        }
        for item in data.get("similar", {}).get("results", [])
    ]