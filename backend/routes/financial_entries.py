from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from helpers.apply_filters import apply_filters
from services.import_csv_nu import import_financial_csv
from schemas.financial_entries import FinancialEntryResponse, FinancialEntryCreate, FinancialEntryUpdate
from db.database import get_session
from core.security import get_current_user
from models.financial_entries import FinancialEntry
from models.user import User
from models.participant import Participant


router = APIRouter()


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

    return {
        "user_name": current_user.name,
        "user_total": total_amount
    }

@router.get("/summary/{participant_id}")
def get_total_participant(participant_id: int, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):

    query = db.query(FinancialEntry)
    participant = db.query(Participant)

    if not current_user.is_admin:
        participant = participant.filter(Participant.id == participant_id, Participant.user_id == current_user.id).first()
        query = query.filter(FinancialEntry.user_id == current_user.id, FinancialEntry.participant_id == participant_id)

    else:
        participant = participant.filter(Participant.id == participant_id).first()
    
    if not participant:
            raise HTTPException(status_code=404, detail="Participante não encontrado.")
    
    query = query.filter(FinancialEntry.participant_id == participant_id)

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
    date_month: Optional[str] = None,
    date_day: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):

    query = db.query(FinancialEntry)

    query = query.filter(
        FinancialEntry.user_id == current_user.id
    )

    query = apply_filters(
        query=query,
        participant_id=participant_id,
        is_reviewed=is_reviewed,
        source=source,
        own_user=own_user,
        date_month=date_month,
        date_day=date_day
    )

    return query.all()


@router.post("/import-csv")
def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
        total = import_financial_csv(
        file.file,
        db,
        current_user.id
    )

        return {
            "message": "Importação concluída",
            "imported": total
        }


@router.get("/{financial_id}", response_model=FinancialEntryResponse)
def get_financial_entry(financial_id: int, db: Session = Depends(get_session)):
    get_fin = db.query(FinancialEntry).filter(FinancialEntry.id == financial_id).first()
    if not get_fin:
        raise HTTPException(status_code=404, detail="Não tem isso ai no banco.")
    return get_fin


@router.patch("/{financial_id}")
def update_financial_entry(
    financial_id: int,
    financial_data: FinancialEntryUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.is_admin:
        financial = db.query(FinancialEntry).filter(
            FinancialEntry.id == financial_id,
        ).first()
    else:
        financial = db.query(FinancialEntry).filter(
            FinancialEntry.id == financial_id,
            FinancialEntry.user_id == current_user.id
        ).first()

    if not financial:
        raise HTTPException(
            status_code=404,
            detail="Lançamento não encontrado"
        )
    
    update_data = financial_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(financial, key, value)

    db.commit()
    db.refresh(financial)

    return financial

@router.delete("/{financial_id}")
def delete_financial_entry(financial_id: int, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    financial = db.query(FinancialEntry)

    if current_user.is_admin:
        financial = financial.filter(FinancialEntry.id == financial_id).first()
    else:
        financial = financial.filter(FinancialEntry.id == financial_id, FinancialEntry.user_id == current_user.id).first()

    if not financial:
        raise HTTPException(
            status_code=404,
            detail="Lançamento não encontrado"
        )
    db.delete(financial)
    db.commit()

    return {"message":"Finança deletada com sucesso."}
