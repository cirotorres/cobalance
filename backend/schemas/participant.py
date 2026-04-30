from pydantic import BaseModel, ConfigDict


class ParticipantCreate(BaseModel):
    user_id: int | None = None
    name: str


class ParticipantResponse(BaseModel):
    id: int
    user_id: int
    name: str

    model_config = ConfigDict(from_attributes=True)
