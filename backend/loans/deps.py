"""Dependências comuns: owner do JWT, gate do módulo, relógio injetável."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.security import get_current_user
from db.database import get_session
from models.loans import UserModulePreference
from models.user import User

TZ = ZoneInfo("America/Fortaleza")


def get_today() -> date:
    """Data civil em America/Fortaleza (sobrescrita nos testes)."""
    return datetime.now(TZ).date()


DEFAULT_PREFS = {"cards_enabled": True, "loans_enabled": False, "default_module": "cards"}


def read_prefs(db: Session, user_id: int) -> dict:
    row = db.get(UserModulePreference, user_id)
    if row is None:
        return dict(DEFAULT_PREFS)
    return {"cards_enabled": row.cards_enabled, "loans_enabled": row.loans_enabled, "default_module": row.default_module}


def loans_owner(db: Session = Depends(get_session), user: User = Depends(get_current_user)) -> User:
    """Usuário autenticado com módulo Empréstimos ativo. Admin NÃO tem bypass."""
    if not read_prefs(db, user.id)["loans_enabled"]:
        raise HTTPException(status_code=403, detail="Módulo Empréstimos não está ativo.")
    return user
