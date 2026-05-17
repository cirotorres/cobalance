from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    # confirmpassword: str
    is_admin: bool = False
    age: int | None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_admin: bool
    age: int | None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
