from pydantic import BaseModel, ConfigDict


class FavoriteCreate(BaseModel):
    user_id: int
    title: str


class FavoriteResponse(BaseModel):
    id: int
    user_id: int
    title: str

    model_config = ConfigDict(from_attributes=True)
