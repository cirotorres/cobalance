from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas.financial_entries import FinancialEntryResponse, FinancialEntryCreate
from db.database import get_session
from core.security import get_current_user
from models.financial_entries import FinancialEntry
from models.user import User
from models.participant import Participant


router = APIRouter()


def apply_filters(query, current_user, participant_id, is_reviewed, source, own_user):
    query = query.filter(FinancialEntry.user_id == current_user.id)

    if own_user:
        query = query.filter(FinancialEntry.participant_id == None)

    if participant_id is not None:
        query = query.filter(FinancialEntry.participant_id == participant_id)

    if is_reviewed is not None:
        query = query.filter(FinancialEntry.is_reviewed == is_reviewed)

    if source is not None:
        query = query.filter(FinancialEntry.source == source)

    return query


@router.post("/", response_model=FinancialEntryResponse)
def create_financial_entry(
    financial_data: FinancialEntryCreate, 
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
    ):

    new_financial = FinancialEntry(
        user_id = current_user.id,
        participant_id = financial_data.participant_id,
        amount = financial_data.amount,
        transaction_date = financial_data.transaction_date,
        description = financial_data.description,
        source = financial_data.source,
        is_reviewed = financial_data.is_reviewed,
        installment_number = financial_data.installment_number,
        installment_total = financial_data.installment_total,
    )

    participant_exist = db.query(Participant).filter(
        Participant.user_id == current_user.id,
        Participant.id == financial_data.participant_id
        ).first()

    if not participant_exist:
        raise HTTPException(status_code=404, detail="Participante não listado.")

    db.add(new_financial)
    db.commit()
    db.refresh(new_financial)

    return new_financial

@router.get("/", response_model=list[FinancialEntryResponse])
def get_all_financial(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=401, detail="Não autorizado.")
    
    get_all = db.query(FinancialEntry).all()
    return get_all


@router.get("/soma")
def calculo_total(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    query = db.query(FinancialEntry)
    if not current_user.is_admin:
        query = query.filter(FinancialEntry.user_id == current_user.id)
    query_final = query.all()
    total_amount = 0
    for valor in query_final:
        total_amount += valor.amount

    return total_amount


@router.get("/financial-entries")
def get_entries(
    participant_id: Optional[int] = None,
    is_reviewed: Optional[bool] = None,
    source: Optional[str] = None,
    own_user: Optional[bool] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
    ):

    query = db.query(FinancialEntry).filter(
        FinancialEntry.user_id == current_user.id
    )

    filter = apply_filters(query, current_user, participant_id, is_reviewed, source, own_user)

    # if own_user == True:
    #     query = query.filter(FinancialEntry.participant_id == None)

    # if participant_id is not None:
    #     query = query.filter(FinancialEntry.participant_id == participant_id)

    # if is_reviewed is not None:
    #     query = query.filter(FinancialEntry.is_reviewed == is_reviewed)

    # if source is not None:
    #     query = query.filter(FinancialEntry.source == source)

    return filter.all()


@router.get("/{financial_id}", response_model=FinancialEntryResponse)
def get_financial_entry(financial_id: int, db: Session = Depends(get_session)):
    get_fin = db.query(FinancialEntry).filter(FinancialEntry.id == financial_id).first()
    if not get_fin:
        raise HTTPException(status_code=404, detail="Não tem isso ai no banco.")
    return get_fin


@router.delete("/{financial_id}")
def delete_financial_entry(financial_id: int, db: Session = Depends(get_session)):
    financial = db.query(FinancialEntry).filter(FinancialEntry.id == financial_id).first()
    if not financial:
        raise HTTPException(status_code=404, detail="Finança não encontrada.")
    db.delete(financial)
    db.commit()

    return {"message":"Finança deletada com sucesso."}
