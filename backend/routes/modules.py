"""SPEC003 — preferências de módulos do titular (GET/PATCH /modules/me)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.security import get_current_user
from db.database import get_session
from loans.deps import read_prefs
from loans.errors import invalid
from models.loans import UserModulePreference
from models.user import User
from schemas.loans import ModulePrefsPatch

router = APIRouter()


@router.get("/me")
def get_my_modules(db: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return read_prefs(db, user.id)


@router.patch("/me")
def patch_my_modules(payload: ModulePrefsPatch, db: Session = Depends(get_session), user: User = Depends(get_current_user)):
    prefs = read_prefs(db, user.id)
    prefs.update(payload.model_dump(exclude_none=True))
    if not (prefs["cards_enabled"] or prefs["loans_enabled"]):
        raise invalid("Ao menos um módulo deve permanecer ativo.")
    if not prefs[f"{prefs['default_module']}_enabled"]:
        raise invalid("O módulo padrão precisa estar ativo.")
    row = db.query(UserModulePreference).filter_by(user_id=user.id).with_for_update().populate_existing().first()
    if row is None:
        row = UserModulePreference(user_id=user.id)
        db.add(row)
    row.cards_enabled = prefs["cards_enabled"]
    row.loans_enabled = prefs["loans_enabled"]
    row.default_module = prefs["default_module"]
    db.commit()
    return prefs
