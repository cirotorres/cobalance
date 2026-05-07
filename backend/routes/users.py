from schemas.user import UserResponse, UserCreate
from db.database import get_session
from models.user import User
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException
from core.security import hash_password, get_current_user

router = APIRouter()

@router.post("/", response_model=UserResponse)
def create_user(user_data: UserCreate, db: Session = Depends(get_session)):

    exist_user = db.query(User).filter(User.email == user_data.email).first()

    if exist_user:
        raise HTTPException(status_code=400,detail="Já existe.")
    
    # if not(user_data.confirmpassword == user_data.password):
    #     raise HTTPException(status_code=400, detail="Confirmação de senha não iguais.")

    hashed_password = hash_password(user_data.password)

    new_user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=hashed_password,
        is_admin=user_data.is_admin,
        age=user_data.age,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.get("/", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=401, detail="Não autorizado.")
    list_all = db.query(User).all()
    return list_all


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_session)):
    get_u = db.query(User).filter(User.id == user_id).first()
    if not get_u:
        raise HTTPException(status_code=404, detail="Usuário inexistente.")
    return get_u


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=401, detail="Não autorizado.")
    
    get_u = db.query(User).filter(User.id == user_id).first()
    if get_u:
        db.delete(get_u)
        db.commit()
    else:
        raise HTTPException(status_code=404, detail="Não encontrado.")
        
    return {"message": f"Usuário {user_id} deletado."}









