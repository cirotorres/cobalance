from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_session
from models.participant import Participant
from models.user import User
from schemas.participant import ParticipantColorUpdate, ParticipantCreate, ParticipantResponse
from core.security import get_current_user

router = APIRouter()

@router.post("/", response_model=ParticipantResponse)
def create_participant(
    participant_data: ParticipantCreate, 
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    target_user_id = current_user.id

    if current_user.is_admin and participant_data.user_id:
        target_user_id = participant_data.user_id

    user = db.query(User).filter(User.id == target_user_id).first()

    exist_participant = db.query(Participant).filter(
        Participant.user_id == target_user_id,
        Participant.name == participant_data.name,
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if exist_participant:
        raise HTTPException(status_code=400, detail="Participante já adicionado.")

    new_participant = Participant(
        user_id=target_user_id,
        name=participant_data.name,
    )

    db.add(new_participant)
    db.commit()
    db.refresh(new_participant)

    return new_participant


@router.get("/", response_model=list[ParticipantResponse])
def list_participants(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=401, detail="Não autorizado.")
    participants = db.query(Participant).all()
    return participants


@router.get("/self", response_model=list[ParticipantResponse])
def list_self_participants(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    self_participants = db.query(Participant).filter(Participant.user_id == current_user.id).order_by(Participant.id.asc())
    return self_participants.all()


@router.get("/{participant_id}", response_model=ParticipantResponse)
def get_participant(participant_id: int, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    query = db.query(Participant).filter(Participant.id == participant_id)

    if not current_user.is_admin:
        query = query.filter(Participant.user_id == current_user.id)

    participant = query.first()

    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    return participant


@router.patch("/color/{participant_id}")
def update_participant_color(
    participant_id: int,
    payload: ParticipantColorUpdate,
    user_id: Optional[int] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    target_user_id = current_user.id

    if current_user.is_admin and user_id:
        target_user_id = user_id

    participant = db.query(Participant).filter(
        Participant.id == participant_id,
        Participant.user_id == target_user_id
    ).first()

    if not participant:
        raise HTTPException(status_code=404, detail="Participant não encontrado.")
    
    participant.color = payload.color

    print(f"[COLOR] Cor do participante: {participant.color}")

    db.commit()
    db.refresh(participant)

    return participant


@router.delete("/{participant_id}")
def delete_participant(participant_id: int, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    query = db.query(Participant).filter(Participant.id == participant_id)

    if not current_user.is_admin:
        query = query.filter(Participant.user_id == current_user.id)

    participant = query.first()

    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado.")

    db.delete(participant)
    db.commit()

    return {"message": f"Participante {participant_id} deletado."}