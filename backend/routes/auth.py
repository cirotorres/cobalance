from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_session
from schemas.user import TokenResponse, LoginRequest
from models.user import User
from core.security import verify_password, create_acess_token

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_session)):
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    acess_token = create_acess_token({'sub': user.email})

    return {
        "access_token": acess_token,
        "token_type": "bearer"
    }
