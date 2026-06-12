from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models import MedicalCounterAlert, MedicalCounterAlertEvent, Printer


def record_medical_counter_error(
    db: Session,
    printer: Printer,
    task_name: str,
    error_message: str,
    run_context: Optional[str] = None,
) -> MedicalCounterAlert:
    """Record an automatic medical counter polling error and aggregate by printer."""
    now = datetime.utcnow()

    alert = (
        db.query(MedicalCounterAlert)
        .filter(
            MedicalCounterAlert.printer_id == printer.id,
            MedicalCounterAlert.status == "open",
        )
        .order_by(MedicalCounterAlert.last_seen_at.desc())
        .first()
    )

    if alert:
        alert.total_errors += 1
        alert.last_seen_at = now
        alert.last_error_message = error_message
        alert.last_task_name = task_name
    else:
        alert = MedicalCounterAlert(
            printer_id=printer.id,
            status="open",
            total_errors=1,
            first_seen_at=now,
            last_seen_at=now,
            last_error_message=error_message,
            last_task_name=task_name,
        )
        db.add(alert)
        db.flush()

    event = MedicalCounterAlertEvent(
        alert_id=alert.id,
        printer_id=printer.id,
        occurred_at=now,
        task_name=task_name,
        error_message=error_message,
        run_context=run_context,
    )
    db.add(event)

    return alert
