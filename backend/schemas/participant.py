from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ParticipantCreate(BaseModel):
    user_id: Optional[int] | None = None
    name: str


class ParticipantResponse(BaseModel):
    id: int
    user_id: int
    name: str
    color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ParticipantColorUpdate(BaseModel):
    color: Optional[str] = Field(pattern=r"^#[0-9A-Fa-f]{6}$")