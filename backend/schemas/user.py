from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    email: str
    password: str
    is_admin: bool = False
    age: int | None


class UserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool
    age: int | None

    model_config = ConfigDict(from_attributes=True)
