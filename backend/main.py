import uvicorn
from fastapi import FastAPI
from routes import participants, auth, users, financial_entries, agente
# from db.init_db import create_db_and_tables
# from contextlib import asynccontextmanager
from models.financial_entries import FinancialEntry
from models.participant import Participant
from models.user import User
from fastapi.middleware.cors import CORSMiddleware

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     create_db_and_tables()
#     yield

# app = FastAPI(lifespan=lifespan)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"], 
)


app.include_router(auth.router, prefix="/auth")
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(participants.router, prefix="/participants", tags=["Participants"])
app.include_router(financial_entries.router, prefix="/financial", tags=["Financial"])
app.include_router(agente.router, prefix="/agente", tags=["Agente"])

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
