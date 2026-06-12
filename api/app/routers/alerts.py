from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import MedicalCounterAlert, MedicalCounterAlertEvent, Printer

router = APIRouter()


class MedicalCounterAlertSummary(BaseModel):
    id: int
    printer_id: int
    printer_brand: Optional[str] = None
    printer_model: Optional[str] = None
    printer_ip: Optional[str] = None
    status: str
    total_errors: int
    first_seen_at: datetime
    last_seen_at: datetime
    last_error_message: Optional[str] = None
    last_task_name: Optional[str] = None


class MedicalCounterAlertEventResponse(BaseModel):
    id: int
    occurred_at: datetime
    task_name: str
    error_message: str
    run_context: Optional[str] = None


class MedicalCounterAlertsStats(BaseModel):
    open_alerts: int
    total_errors_open_alerts: int


class ResolveAlertRequest(BaseModel):
    resolved_by: Optional[str] = None
    resolved_notes: Optional[str] = None


@router.get("/medical-counter-errors", response_model=List[MedicalCounterAlertSummary])
def list_medical_counter_alerts(
    status: str = "open",
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if status not in {"open", "resolved"}:
        raise HTTPException(status_code=400, detail="status must be 'open' or 'resolved'")

    limit = max(1, min(limit, 500))

    rows = (
        db.query(MedicalCounterAlert, Printer)
        .join(Printer, MedicalCounterAlert.printer_id == Printer.id)
        .filter(MedicalCounterAlert.status == status)
        .order_by(MedicalCounterAlert.last_seen_at.desc())
        .limit(limit)
        .all()
    )

    return [
        MedicalCounterAlertSummary(
            id=alert.id,
            printer_id=alert.printer_id,
            printer_brand=printer.brand,
            printer_model=printer.model,
            printer_ip=printer.ip,
            status=alert.status,
            total_errors=alert.total_errors,
            first_seen_at=alert.first_seen_at,
            last_seen_at=alert.last_seen_at,
            last_error_message=alert.last_error_message,
            last_task_name=alert.last_task_name,
        )
        for alert, printer in rows
    ]


@router.get("/medical-counter-errors/stats", response_model=MedicalCounterAlertsStats)
def get_medical_counter_alerts_stats(db: Session = Depends(get_db)):
    open_alerts = (
        db.query(func.count(MedicalCounterAlert.id))
        .filter(MedicalCounterAlert.status == "open")
        .scalar()
        or 0
    )

    total_errors_open_alerts = (
        db.query(func.coalesce(func.sum(MedicalCounterAlert.total_errors), 0))
        .filter(MedicalCounterAlert.status == "open")
        .scalar()
        or 0
    )

    return MedicalCounterAlertsStats(
        open_alerts=open_alerts,
        total_errors_open_alerts=total_errors_open_alerts,
    )


@router.get("/medical-counter-errors/{alert_id}/events", response_model=List[MedicalCounterAlertEventResponse])
def get_alert_events(
    alert_id: int,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    alert = db.query(MedicalCounterAlert).filter(MedicalCounterAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    limit = max(1, min(limit, 1000))

    events = (
        db.query(MedicalCounterAlertEvent)
        .filter(MedicalCounterAlertEvent.alert_id == alert_id)
        .order_by(MedicalCounterAlertEvent.occurred_at.desc())
        .limit(limit)
        .all()
    )

    return [
        MedicalCounterAlertEventResponse(
            id=event.id,
            occurred_at=event.occurred_at,
            task_name=event.task_name,
            error_message=event.error_message,
            run_context=event.run_context,
        )
        for event in events
    ]


@router.patch("/medical-counter-errors/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    body: ResolveAlertRequest,
    db: Session = Depends(get_db),
):
    alert = db.query(MedicalCounterAlert).filter(MedicalCounterAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = body.resolved_by
    alert.resolved_notes = body.resolved_notes

    db.commit()

    return {
        "message": "Alert resolved",
        "alert_id": alert.id,
        "resolved_at": alert.resolved_at,
    }
