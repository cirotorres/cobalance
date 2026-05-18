import json
from datetime import date
from core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from ollama import Client, Options


hoje = date.today().isoformat()


def _parse_json_response(response: str):
    response = response.strip()

    if response.startswith("```json"):
        response = response.removeprefix("```json").removesuffix("```").strip()
    elif response.startswith("```"):
        response = response.removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        return {"error": "Resposta inválida", "raw": response}


def interpretar_comando_financeiro(pergunta: str):
    client = Client(
        host=LLM_BASE_URL,
        headers={'Authorization': 'Bearer ' + LLM_API_KEY}
    )

    messages = [
        {
            'role': 'system',
            'content':
            f'''
                Retorne SOMENTE JSON puro.
                Não use markdown.
                Não use ```json.
                Não escreva explicações fora do JSON.

                Você interpreta comandos financeiros em português.
                Retorne sempre um objeto JSON com:
                  intent,
                  entries,
                  participant_name,
                  message.

                Intenções permitidas:
                  - "create_financial_entries": quando o usuário quiser criar, lançar, registrar ou adicionar uma finança.
                  - "get_participant_total": quando o usuário quiser consultar o total de um participante.
                  - "unknown": quando não for uma ação financeira suportada.

                Tipos de source permitidas:
                  - "credito"
                  - "debito"
                  - "pix"
                  - "extrato"

                Para "create_financial_entries":
                  - entries deve ser um array de lançamentos.
                  - Cada lançamento deve ter:
                    amount,
                    description,
                    transaction_date,
                    installment_number,
                    installment_total,
                    participant_name,
                    source = "credito" (default),
                  - participant_name no topo pode ser null.
                  - source só poderá ser algum dos outros tipos acima, caso seja especificado. 

                Para "get_participant_total":
                  - participant_name deve conter o nome do participante.
                  - entries deve ser [].

                Para "unknown":
                  - entries deve ser [].
                  - participant_name deve ser null.
                  - message deve explicar brevemente o motivo.

                Se não especificar data, use esta data atual: {hoje}.
                Se não houver parcelamento, installment_number = 1 e installment_total = 1.
                Em parcelamentos, gere uma entrada por mês, dividindo o valor total pelo número de parcelas quando o total estiver explícito.
                Em parcelamentos de mais de 1x, inclua nas descriptions as parcelas correspondentes. 
            '''
        },
        {
            'role': 'user',
            'content': pergunta,
        },
    ]

    response = ""

    for part in client.chat(LLM_MODEL, messages=messages, stream=True, options=Options(temperature=0)):
        response += part.message.content

    return _parse_json_response(response)
