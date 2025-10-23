from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager

from .db import engine, Base, get_db
from .routers import auth, printers, incidents, reports, counters, contracts, toner_requests
from .workers.polling import start_scheduler

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize scheduler
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler(scheduler)
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()

app = FastAPI(
    title="Printer Fleet Manager API",
    description="API for managing printer fleets with SNMP monitoring",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(printers.router, prefix="/printers", tags=["printers"])
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(counters.router, prefix="/counters", tags=["counters"])
app.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
app.include_router(toner_requests.router, prefix="/api", tags=["toner-requests"])

@app.get("/")
async def root():
    return {"message": "Printer Fleet Manager API", "version": "1.0.0"}

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {"status": "healthy", "database": "connected"}