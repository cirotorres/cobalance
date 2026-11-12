"""SPEC003 — rotas /loans/*. Owner SEMPRE derivado do JWT; sem bypass admin.

Handlers finos: lógica financeira em `loans.service` / `loans.schedule`.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_session
from loans import service, reports
from loans.deps import get_today, loans_owner
from loans.errors import conflict, invalid, not_found
from loans.pix import PixError, normalize_key
from loans.serializers import borrower_out, pix_out
from models.loans import LoanBorrower, LoanPixAccount
from models.user import User
from schemas.loans import (
    AdjustmentCreate, BorrowerCreate, BorrowerPatch, ChargeCreate, ContractCreate, FundRequest,
    PixCreate, PixPatch, PrepaymentPreview, ReceiptCreate, ReverseRequest, Terms,
)

router = APIRouter()


def owned_borrower(db: Session, user: User, borrower_id: int, *, lock=False) -> LoanBorrower:
    q = db.query(LoanBorrower).filter(LoanBorrower.id == borrower_id, LoanBorrower.user_id == user.id)
    if lock:
        q = q.with_for_update().populate_existing()
    b = q.first()
    if b is None:
        raise not_found("Tomador")
    return b


# ---------------------------------------------------------------- tomadores
@router.get("/borrowers")
def list_borrowers(include_archived: bool = False, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    q = db.query(LoanBorrower).filter(LoanBorrower.user_id == user.id)
    if not include_archived:
        q = q.filter(LoanBorrower.archived_at.is_(None))
    return [borrower_out(b) for b in q.order_by(LoanBorrower.name_normalized, LoanBorrower.id)]


@router.post("/borrowers", status_code=201)
def create_borrower(payload: BorrowerCreate, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    b = LoanBorrower(user_id=user.id, name=payload.name, name_normalized=payload.name.casefold(),
                     contact=payload.contact, note=payload.note)
    db.add(b)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("Já existe tomador ativo com este nome.")
    return borrower_out(b)


@router.get("/borrowers/{borrower_id}")
def get_borrower(borrower_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return borrower_out(owned_borrower(db, user, borrower_id))


@router.patch("/borrowers/{borrower_id}")
def patch_borrower(borrower_id: int, payload: BorrowerPatch, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    b = owned_borrower(db, user, borrower_id, lock=True)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        b.name, b.name_normalized = data["name"], data["name"].casefold()
    for f in ("contact", "note"):
        if f in data:
            setattr(b, f, (data[f] or "").strip() or None)
    if "archived" in data:
        b.archived_at = datetime.now(timezone.utc) if data["archived"] else None
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("Já existe tomador ativo com este nome.")
    return borrower_out(b)


@router.get("/borrowers/{borrower_id}/statement")
def borrower_statement(borrower_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner),
                       today=Depends(get_today)):
    b = owned_borrower(db, user, borrower_id)
    return reports.statement(db, user.id, b, today)


# ---------------------------------------------------------------- contas Pix
def owned_pix(db, user, pix_id, lock=False) -> LoanPixAccount:
    q = db.query(LoanPixAccount).filter(LoanPixAccount.id == pix_id, LoanPixAccount.user_id == user.id)
    if lock:
        q = q.with_for_update().populate_existing()
    p = q.first()
    if p is None:
        raise not_found("Conta Pix")
    return p


def _lock_user_pix(db, user):
    return db.query(LoanPixAccount).filter(LoanPixAccount.user_id == user.id).order_by(LoanPixAccount.id).with_for_update().populate_existing().all()


@router.get("/pix-accounts")
def list_pix(db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    q = db.query(LoanPixAccount).filter(LoanPixAccount.user_id == user.id).order_by(LoanPixAccount.id)
    return [pix_out(p) for p in q]


@router.post("/pix-accounts", status_code=201)
def create_pix(payload: PixCreate, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    try:
        ktype, key = normalize_key(payload.key)
    except PixError as e:
        raise invalid(str(e))
    existing = _lock_user_pix(db, user)
    has_default = any(p.is_default for p in existing)
    p = LoanPixAccount(user_id=user.id, label=payload.label, institution=payload.institution,
                       holder_name=payload.holder_name, city=payload.city, key_type=ktype, key=key,
                       is_default=not has_default, is_active=True)
    db.add(p)
    db.commit()
    return pix_out(p)


@router.patch("/pix-accounts/{pix_id}")
def patch_pix(pix_id: int, payload: PixPatch, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    owned_pix(db, user, pix_id)
    accounts = _lock_user_pix(db, user)
    p = next(a for a in accounts if a.id == pix_id)
    data = payload.model_dump(exclude_unset=True)
    for f in ("label", "holder_name", "city", "institution"):
        if f in data and data[f] is not None:
            setattr(p, f, data[f].strip())
    if data.get("is_active") is False and p.is_active:
        others = [a for a in accounts if a.id != p.id and a.is_active]
        if p.is_default and others:
            raise conflict("Defina outra conta como padrão antes de desativar esta.")
        p.is_default = False
        p.is_active = False
    elif data.get("is_active") is True and not p.is_active:
        p.is_active = True
        if not any(a.is_default for a in accounts):
            p.is_default = True
    db.commit()
    return pix_out(p)


@router.post("/pix-accounts/{pix_id}/default")
def set_default_pix(pix_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    owned_pix(db, user, pix_id)
    accounts = _lock_user_pix(db, user)
    p = next(a for a in accounts if a.id == pix_id)
    if not p.is_active:
        raise conflict("Conta inativa não pode ser padrão.")
    for a in accounts:
        if a.is_default and a.id != p.id:
            a.is_default = False
    db.flush()
    p.is_default = True
    db.commit()
    return pix_out(p)


# ---------------------------------------------------------------- contratos
@router.post("/simulate")
def simulate(payload: Terms, user: User = Depends(loans_owner)):
    return service.simulate(payload)


@router.get("/contracts")
def list_contracts(borrower_id: int | None = None, status: str | None = None, db: Session = Depends(get_session),
                   user: User = Depends(loans_owner), today=Depends(get_today)):
    return service.list_contracts(db, user, today, borrower_id=borrower_id, status=status)


@router.post("/contracts", status_code=201)
def create_contract(payload: ContractCreate, response: Response, db: Session = Depends(get_session),
                    user: User = Depends(loans_owner), today=Depends(get_today)):
    out, created = service.create_contract(db, user, payload, today)
    if not created:
        response.status_code = 200
    return out


@router.get("/contracts/{loan_id}")
def get_contract(loan_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner), today=Depends(get_today)):
    return service.contract_detail(db, user, loan_id, today)


@router.post("/contracts/{loan_id}/fund")
def fund_contract(loan_id: int, payload: FundRequest, db: Session = Depends(get_session), user: User = Depends(loans_owner),
                  today=Depends(get_today)):
    return service.fund_contract(db, user, loan_id, payload, today)


@router.post("/contracts/{loan_id}/cancel")
def cancel_contract(loan_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner), today=Depends(get_today)):
    return service.cancel_contract(db, user, loan_id, today)


@router.post("/contracts/{loan_id}/prepayment-preview")
def prepayment_preview(loan_id: int, payload: PrepaymentPreview, db: Session = Depends(get_session),
                       user: User = Depends(loans_owner)):
    return service.prepayment_preview(db, user, loan_id, payload)


# ---------------------------------------------------------------- recebimentos
@router.post("/receipts", status_code=201)
def create_receipt(payload: ReceiptCreate, response: Response, db: Session = Depends(get_session),
                   user: User = Depends(loans_owner), today=Depends(get_today)):
    out, created = service.create_receipt(db, user, payload, today)
    if not created:
        response.status_code = 200
    return out


@router.get("/receipts")
def list_receipts(borrower_id: int | None = None, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.list_receipts(db, user, borrower_id)


@router.get("/receipts/{receipt_id}")
def get_receipt(receipt_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.receipt_detail(db, user, receipt_id)


@router.post("/receipts/{receipt_id}/reverse")
def reverse_receipt(receipt_id: int, payload: ReverseRequest, db: Session = Depends(get_session),
                    user: User = Depends(loans_owner)):
    return service.reverse_receipt(db, user, receipt_id, payload)


# ---------------------------------------------------------------- ajustes manuais
@router.post("/installments/{installment_id}/adjustments", status_code=201)
def create_adjustment(installment_id: int, payload: AdjustmentCreate, response: Response,
                      db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    out, created = service.create_adjustment(db, user, installment_id, payload)
    if not created:
        response.status_code = 200
    return out


@router.post("/adjustments/{adjustment_id}/reverse")
def reverse_adjustment(adjustment_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.reverse_adjustment(db, user, adjustment_id)


# ---------------------------------------------------------------- cobranças Pix
@router.post("/charges", status_code=201)
def create_charge(payload: ChargeCreate, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.create_charge(db, user, payload)


@router.get("/charges")
def list_charges(borrower_id: int | None = None, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.list_charges(db, user, borrower_id)


@router.get("/charges/{charge_id}")
def get_charge(charge_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.charge_detail(db, user, charge_id)


@router.post("/charges/{charge_id}/shared")
def mark_charge_shared(charge_id: int, db: Session = Depends(get_session), user: User = Depends(loans_owner)):
    return service.mark_charge_shared(db, user, charge_id)


# ---------------------------------------------------------------- painel / relatórios
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_session), user: User = Depends(loans_owner), today=Depends(get_today)):
    return reports.portfolio(db, user.id, today)


@router.get("/reports/monthly")
def monthly_report(month: str, db: Session = Depends(get_session), user: User = Depends(loans_owner), today=Depends(get_today)):
    return reports.monthly(db, user.id, month, today)
