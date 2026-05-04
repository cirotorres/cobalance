from core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from ollama import Client

client = Client(
    host=LLM_BASE_URL,
    headers={'Authorization': 'Bearer ' + LLM_API_KEY}
)

messages = [
    {
        'role': 'user',
        'content': 'Me explique em uma frase o que é FastAPI',
    },
]

for part in client.chat(LLM_MODEL, messages=messages, stream=True):
    print(part.message.content, end='', flush=True)
print()