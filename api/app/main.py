from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager

from .db import engine, Base, get_db
from .routers import auth, printers, incidents, reports, counters, contracts, toner_requests, stock, discovery_configs, billing, exchange_rates, companies
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

# CORS middleware - más permisivo para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todos los orígenes en desarrollo
    allow_credentials=True,
    allow_methods=["*"],  # Permitir todos los métodos
    allow_headers=["*"],  # Permitir todos los headers
    expose_headers=["*"]  # Exponer todos los headers
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(printers.router, prefix="/printers", tags=["printers"])
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(counters.router, prefix="/counters", tags=["counters"])
app.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
app.include_router(companies.router, prefix="/companies", tags=["companies"])
app.include_router(billing.router, prefix="/api", tags=["billing"])
app.include_router(toner_requests.router, prefix="/api", tags=["toner-requests"])
app.include_router(stock.router, prefix="/stock", tags=["stock"])
app.include_router(discovery_configs.router, prefix="/discovery", tags=["discovery-configs"])
app.include_router(exchange_rates.router, prefix="/exchange-rates", tags=["exchange-rates"])

# Import and include auto_counters router
from .routers import auto_counters
app.include_router(auto_counters.router, prefix="/auto-counters", tags=["auto-counters"])

# Import and include counter_collection router
from .routers import counter_collection
app.include_router(counter_collection.router, prefix="/counter-collection", tags=["counter-collection"])

# Import and include printer_tools router
from .routers import printer_tools
app.include_router(printer_tools.router, prefix="/printer-tools", tags=["printer-tools"])

# Import and include medical_printers router
from .routers import medical_printers
app.include_router(medical_printers.router, prefix="/medical-printers", tags=["medical-printers"])

# Import and include medical_refills router
from .routers import medical_refills
app.include_router(medical_refills.router, prefix="/medical-printers", tags=["medical-refills"])

@app.get("/")
async def root():
    return {"message": "Printer Fleet Manager API", "version": "1.0.0"}

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {"status": "healthy", "database": "connected"}

@app.get("/scheduler/jobs")
async def get_scheduler_jobs():
    """Ver jobs activos del scheduler"""
    jobs = scheduler.get_jobs()
    return {
        "total_jobs": len(jobs),
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run_time": str(job.next_run_time) if job.next_run_time else None,
                "trigger": str(job.trigger)
            }
            for job in jobs
        ]
    }