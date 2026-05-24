from fastapi import APIRouter, Depends, HTTPException
# from fastapi.security import OAuth2PasswordRequestForm
from core.config import ALGORITHM, SECRET_KEY
from schemas.user import LoginRequest, RefreshTokenRequest
from sqlalchemy.orm import Session
from db.database import get_session
from schemas.user import TokenResponse
from models.user import User
from core.security import verify_password, create_access_token, get_current_user, create_refresh_token
import jwt

router = APIRouter()

'''
Swagger -> 
    use: from fastapi.security import OAuth2PasswordRequestForm
    use: login_data: OAuth2PasswordRequestForm = Depends()
    use: user = db.query(User).filter(User.email == login_data.username).first()
    
Front React ->
    use: from schemas.user import LoginRequest
    use: login_data: LoginRequest
    use: user = db.query(User).filter(User.email == login_data.email).first()
'''

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_session)):
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    access_token = create_access_token(
        {
            'sub': user.email,
            'id': user.id,
        }
        )


    refresh_token = create_refresh_token(
        {
            'sub': user.email,
            'id': user.id,
        }
        )
    

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer"
    }


@router.post("/refresh")
def refresh_login(refresh_data: RefreshTokenRequest, db: Session = Depends(get_session)):
    
    payload = jwt.decode(
        refresh_data.refresh_token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )

    user_id = payload.get("id")

    user = db.query(User).filter( User.id == user_id).first()

    new_access_token = create_access_token(
        {
            'sub': user.email,
            'id': user.id,
        }
    )

    return {
        "access_token": new_access_token,
    }


@router.get("/me")
def profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "email": current_user.email,
        "is_admin": current_user.is_admin
    }


@router.get("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}




