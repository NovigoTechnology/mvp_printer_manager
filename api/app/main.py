from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator
from datetime import datetime, timezone
import redis as redis_lib
import logging

from .config import settings
from .db import engine, Base, get_db
from .routers import auth, printers, incidents, reports, counters, contracts, toner_requests, stock, discovery_configs, billing, exchange_rates, companies, cost_centers
from .workers.polling import start_scheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize rate limiter
# Rate limit key function - uses client IP address
# Default limits configurado desde settings
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])

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
    version=settings.app_version,
    lifespan=lifespan
)

# Prometheus metrics - instrumenta automáticamente todos los endpoints
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - Configurado desde settings (variables de entorno)
# En producción, especificar dominios permitidos en CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])

# Apply limiter decorator to auth router
from slowapi import Limiter
from slowapi.util import get_remote_address

# Get limiter from app state for route-specific limits
def get_limiter():
    return limiter
app.include_router(printers.router, prefix="/printers", tags=["printers"])
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(counters.router, prefix="/counters", tags=["counters"])
app.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
app.include_router(companies.router, prefix="/companies", tags=["companies"])
app.include_router(cost_centers.router, prefix="/cost-centers", tags=["cost-centers"])
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

# Import and include alerts router
from .routers import alerts
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])

@app.get("/")
async def root():
    return {"message": "Printer Fleet Manager API", "version": "1.0.0"}

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {"status": "healthy", "database": "connected"}


def _check_redis() -> dict:
    """Verifica conectividad con Redis y retorna estado detallado."""
    try:
        r = redis_lib.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password,
            socket_connect_timeout=2
        )
        r.ping()
        info = r.info("server")
        return {
            "status": "connected",
            "version": info.get("redis_version", "unknown"),
            "used_memory_human": info.get("used_memory_human", "unknown")
        }
    except Exception as e:
        return {"status": "unavailable", "error": str(e)}


def _check_database(db: Session) -> dict:
    """Verifica conectividad con la base de datos."""
    try:
        db.execute(__import__('sqlalchemy').text('SELECT 1'))
        return {"status": "connected"}
    except Exception as e:
        return {"status": "unavailable", "error": str(e)}


@app.get("/health/detailed", tags=["health"])
async def health_detailed(db: Session = Depends(get_db)):
    """Health check detallado: database, Redis, scheduler y versión."""
    db_status = _check_database(db)
    redis_status = _check_redis()
    scheduler_status = {
        "status": "running" if scheduler.running else "stopped",
        "job_count": len(scheduler.get_jobs())
    }

    services_ok = (
        db_status["status"] == "connected"
        and redis_status["status"] == "connected"
        and scheduler_status["status"] == "running"
    )

    return {
        "status": "healthy" if services_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.app_version,
        "services": {
            "database": db_status,
            "redis": redis_status,
            "scheduler": scheduler_status
        }
    }

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