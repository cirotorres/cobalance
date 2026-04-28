from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_session
from models.participant import Participant
from models.user import User
from schemas.participant import ParticipantCreate, ParticipantResponse

router = APIRouter()

@router.post("/", response_model=ParticipantResponse)
def create_participant(
    participant_data: ParticipantCreate, db: Session = Depends(get_session)
):
    user = db.query(User).filter(User.id == participant_data.user_id).first()
    exist_participant = db.query(Participant).filter(
        Participant.user_id == participant_data.user_id,
        Participant.name == participant_data.name,
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if exist_participant:
        raise HTTPException(status_code=400, detail="Participante já adicionado.")

    new_participant = Participant(
        user_id=participant_data.user_id,
        name=participant_data.name,
    )

    db.add(new_participant)
    db.commit()
    db.refresh(new_participant)

    return new_participant


@router.get("/", response_model=list[ParticipantResponse])
def list_participants(db: Session = Depends(get_session)):
    participants = db.query(Participant).all()
    return participants


@router.get("/{participant_id}", response_model=ParticipantResponse)
def get_participant(participant_id: int, db: Session = Depends(get_session)):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()

    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    return participant


@router.delete("/{participant_id}")
def delete_participant(participant_id: int, db: Session = Depends(get_session)):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()

    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado.")

    db.delete(participant)
    db.commit()

    return {"message": f"Participante {participant_id} deletado."}