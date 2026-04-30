from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from db.database import get_session
from schemas.user import TokenResponse
from models.user import User
from core.security import verify_password, create_acess_token, get_current_user

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(login_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    user = db.query(User).filter(User.email == login_data.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    acess_token = create_acess_token(
        {
            'sub': user.email,
            'id': user.id,
        }
        )

    return {
        "access_token": acess_token,
        "token_type": "Bearer"
    }

@router.get("/me")
def profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "email": current_user.email,
        "is_admin": current_user.is_admin
    }