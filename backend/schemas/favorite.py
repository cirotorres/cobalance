from pydantic import BaseModel


class FavoriteCreate(BaseModel):
    user_id: int
    title: str


class FavoriteResponse(BaseModel):
    id: int
    user_id: int
    title: str

    class Config:
        from_attributes = True
