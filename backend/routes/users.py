from schemas.user import UserResponse, UserCreate
from db.database import get_session
from models.user import User
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()

@router.post("/", response_model=UserResponse)
def create_user(user_data: UserCreate, db: Session = Depends(get_session)):

    exist_user = db.query(User).filter(User.email == user_data.email).first()
    if exist_user:
        raise HTTPException(status_code=400,detail="Já existe.")

    new_user = User(
        email=user_data.email,
        password=user_data.password,
        is_admin=user_data.is_admin,
        age=user_data.age
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.get("/", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_session)):
    list_all = db.query(User).all()
    return list_all

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_session)):
    get_u = db.query(User).filter(User.id == user_id).first()
    if not get_u:
        raise HTTPException(status_code=404, detail="Usuário inexistente")
    return get_u


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_session)):
    get_u = db.query(User).filter(User.id == user_id).first()
    if get_u:
        db.delete(get_u)
        db.commit()
    else:
        raise HTTPException(status_code=404, detail="Não encontrado.")
        
    return {"message": f"Usuário {user_id} deletado."}









