import requests

def get_booklist():
    response = requests.get("https://jsonplaceholder.typicode.com/posts")
    return response.json()