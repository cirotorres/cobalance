import requests

def search_books(query: str):
    url = f"https://openlibrary.org/search.json?q={query}"
    response = requests.get(url)
    data = response.json()

    return [
        {
            "title": book.get("title"),
            "author": book.get("author_name", ["Unknown"])[0]
        }
        for book in data.get("docs", [])[:10]
    ]