from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    password: str
    is_admin: bool = False


class UserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool

    class Config:
        from_attributes = True
