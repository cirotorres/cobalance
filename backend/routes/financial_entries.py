from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas.financial_entries import FinancialEntryResponse, FinancialEntryCreate
from db.database import get_session
from models.financial_entries import FinancialEntry


router = APIRouter()

@router.post("/", response_model=FinancialEntryResponse)
def create_financial_entry(financial_data: FinancialEntryCreate, db: Session = Depends(get_session)):

    new_financial = FinancialEntry(
        user_id = financial_data.user_id,
        participant_id = financial_data.participant_id,
        amount = financial_data.amount,
        transaction_date = financial_data.transaction_date,
        description = financial_data.description,
        source = financial_data.source,
        is_reviewed = financial_data.is_reviewed,
        installment_number = financial_data.installment_number,
        installment_total = financial_data.installment_total,
    )

    db.add(new_financial)
    db.commit()
    db.refresh(new_financial)

    return new_financial

@router.get("/", response_model=list[FinancialEntryResponse])
def get_all_financial(db: Session = Depends(get_session)):
    get_all = db.query(FinancialEntry).all()
    return get_all


@router.get("/cal")
def calculo_total(db: Session = Depends(get_session)):
    get_all = db.query(FinancialEntry).all()
    total_amount = 0
    for valor in get_all:
        total_amount += valor.amount

    return total_amount


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



        

