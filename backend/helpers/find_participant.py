from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.participant import Participant
from models.user import User



def find_participant_by_name(db: Session, current_user: User, participant_name: str):
    participant = db.query(Participant).filter(
        Participant.name.ilike(participant_name),
        Participant.user_id == current_user.id
    ).first()

    if participant:
        return participant

    matches = db.query(Participant).filter(
        Participant.name.ilike(f"%{participant_name}%"),
        Participant.user_id == current_user.id
    ).all()

    if len(matches) == 1:
        return matches[0]

    if len(matches) > 1:
        raise HTTPException(
            status_code=409,
            detail="Mais de um participante encontrado para esse nome."
        )

    raise HTTPException(
        status_code=404,
        detail=f"Participante '{participant_name}' não listado."
    )