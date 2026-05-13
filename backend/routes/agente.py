from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from models.financial_entries import FinancialEntry
from helpers.create_entries_llm import create_entries_from_llm_items, find_participant_by_name
from routes.financial_entries import get_total_participant
from core.security import get_current_user
from models.user import User
from services.llm_service import interpretar_comando_financeiro
from db.database import get_session
from schemas.financial_entries import FinancialEntryAICreate, FinancialEntryResponse
from sqlalchemy.orm import Session

router = APIRouter()

@router.post("/")
def financial_assistant(
    data: FinancialEntryAICreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    command = interpretar_comando_financeiro(data.text)

    if not isinstance(command, dict):
        raise HTTPException(
            status_code=400,
            detail="Resposta inválida da IA"
        )

    if command.get("error"):
        raise HTTPException(
            status_code=400,
            detail=command["error"]
        )

    intent = command.get("intent")

    if intent == "create_financial_entries":
        entries = command.get("entries", [])

        if not entries:
            raise HTTPException(
                status_code=400,
                detail="Nenhum lançamento financeiro foi identificado."
            )

        try:
            created_entries = create_entries_from_llm_items(entries, db, current_user)
        except ValidationError as error:
            raise HTTPException(status_code=422, detail=error.errors())

        return {
            "intent": intent,
            "message": f"{len(created_entries)} lançamento(s) criado(s) com sucesso.",
            "entries": [
                FinancialEntryResponse.model_validate(entry).model_dump(mode="json")
                for entry in created_entries
            ],
        }

    if intent == "get_participant_total":
        participant_name = command.get("participant_name")

        if not participant_name:
            raise HTTPException(
                status_code=400,
                detail="Nenhum participante foi identificado."
            )

        participant = find_participant_by_name(db, current_user, participant_name)

        if participant:
            participant_total = get_total_participant(participant.id, db, current_user)

        return {
            "intent": intent,
            "participant_id": participant.id,
            "participant_name": participant.name,
            "total_amount": participant_total,
            "message": f"Total de {participant.name}: {participant_total}",
        }

    raise HTTPException(
        status_code=400,
        detail=command.get("message", "Não consegui identificar uma ação suportada.")
    )