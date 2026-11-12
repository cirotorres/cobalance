import uvicorn
from fastapi import FastAPI
from routes import participants, auth, users, financial_entries, agente
from routes import modules as modules_routes, loans as loans_routes  # SPEC003
import os
# from db.init_db import create_db_and_tables
# from contextlib import asynccontextmanager
from models.financial_entries import FinancialEntry
from models.financial_entry_batches import FinancialEntryBatch  # noqa: F401  SPEC001
from models.participant import Participant
from models.user import User
import models.loans  # noqa: F401  SPEC003
from fastapi.middleware.cors import CORSMiddleware

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     create_db_and_tables()
#     yield

# app = FastAPI(lifespan=lifespan)

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://192.168.100.106:5173",
    "https://cobalance-ctorr.vercel.app",
]
# SPEC003: origens extras opcionais (ex.: E2E local). Vazio por padrão.
origins += [o.strip() for o in os.getenv("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"], 
)


app.include_router(auth.router, prefix="/auth")
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(participants.router, prefix="/participants", tags=["Participants"])
app.include_router(financial_entries.router, prefix="/financial", tags=["Financial"])
app.include_router(agente.router, prefix="/agente", tags=["Agente"])
app.include_router(modules_routes.router, prefix="/modules", tags=["Modules"])  # SPEC003
app.include_router(loans_routes.router, prefix="/loans", tags=["Loans"])  # SPEC003

# if __name__ == "__main__":
#     uvicorn.run("main:app", reload=True)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )