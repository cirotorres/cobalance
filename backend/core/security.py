"""Autenticação JWT: access e refresh têm tipos criptograficamente protegidos distintos."""
from datetime import datetime, timedelta, timezone
from http import HTTPStatus

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError, decode, encode
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, REFRESH_TOKEN_EXPIRE_DAYS, SECRET_KEY
from db.database import get_session
from models.user import User

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def _new_token(data: dict, token_type: str, lifetime: timedelta) -> str:
    issued_at = datetime.now(timezone.utc)
    # O tipo/iat/exp não podem ser manipulados por dados fornecidos ao emissor.
    payload = {**data, "token_type": token_type, "iat": int(issued_at.timestamp()),
               "exp": issued_at + lifetime}
    return encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
    return _new_token(data, "access", timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))


def create_refresh_token(data: dict) -> str:
    return _new_token(data, "refresh", timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def authenticated_user_for_token(token: str, expected_type: str, db: Session) -> User:
    """Validar assinatura/exp/tipo/sub/id; falhas de credencial SEMPRE resultam em 401."""
    unauthenticated = HTTPException(
        status_code=HTTPStatus.UNAUTHORIZED,
        detail="Token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode(
            token, SECRET_KEY, algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "id", "token_type"]},
        )
    except (InvalidTokenError, ValueError, TypeError):
        raise unauthenticated from None

    email = payload.get("sub")
    user_id = payload.get("id")
    if payload.get("token_type") != expected_type or not isinstance(email, str) or not email.strip():
        raise unauthenticated
    # Impedir coerção silenciosa de claims (p.ex. bool/str como inteiro).
    if type(user_id) is not int or user_id < 1:
        raise unauthenticated

    user = db.query(User).filter(User.id == user_id, User.email == email).first()
    if user is None:
        raise unauthenticated
    return user


def get_current_user(
    db: Session = Depends(get_session),
    token: str = Depends(oauth2_scheme),
):
    return authenticated_user_for_token(token, "access", db)
