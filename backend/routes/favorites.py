from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_session
from models.favorite import Favorite
from models.user import User
from schemas.favorite import FavoriteCreate, FavoriteResponse

router = APIRouter()


@router.post("/", response_model=FavoriteResponse)
def create_favorite(
    favorite_data: FavoriteCreate, db: Session = Depends(get_session)
):
    user = db.query(User).filter(User.id == favorite_data.user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_favorite = Favorite(
        user_id=favorite_data.user_id,
        title=favorite_data.title,
    )

    db.add(new_favorite)
    db.commit()
    db.refresh(new_favorite)

    return new_favorite


@router.get("/", response_model=list[FavoriteResponse])
def list_favorites(db: Session = Depends(get_session)):
    favorites = db.query(Favorite).all()
    return favorites


@router.get("/{favorite_id}", response_model=FavoriteResponse)
def get_favorite(favorite_id: int, db: Session = Depends(get_session)):
    favorite = db.query(Favorite).filter(Favorite.id == favorite_id).first()

    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    return favorite
