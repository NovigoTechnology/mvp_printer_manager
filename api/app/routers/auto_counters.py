from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import json

from ..db import get_db
from ..models import CounterSchedule, Printer, MonthlyCounter
from ..services.snmp import SNMPService

router = APIRouter()

# Pydantic models
class CounterScheduleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule_type: str  # interval, cron, daily, weekly, monthly
    interval_minutes: Optional[int] = None
    cron_expression: Optional[str] = None
    time_of_day: Optional[str] = None  # HH:MM
    day_of_week: Optional[int] = None  # 0=Monday, 6=Sunday
    day_of_month: Optional[int] = None  # 1-31
    target_type: str  # all, selection, single
    printer_ids: Optional[List[int]] = None
    is_active: bool = True
    retry_on_failure: bool = True
    max_retries: int = 3
    notify_on_failure: bool = False
    notification_emails: Optional[List[str]] = None
    created_by: Optional[str] = None

class CounterScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule_type: Optional[str] = None
    interval_minutes: Optional[int] = None
    cron_expression: Optional[str] = None
    time_of_day: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    target_type: Optional[str] = None
    printer_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None
    retry_on_failure: Optional[bool] = None
    max_retries: Optional[int] = None
    notify_on_failure: Optional[bool] = None
    notification_emails: Optional[List[str]] = None

class CounterScheduleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    schedule_type: str
    interval_minutes: Optional[int]
    cron_expression: Optional[str]
    time_of_day: Optional[str]
    day_of_week: Optional[int]
    day_of_month: Optional[int]
    target_type: str
    printer_ids: Optional[List[int]] = []  # List instead of JSON string for API response
    is_active: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    run_count: int
    error_count: int
    last_error: Optional[str]
    retry_on_failure: bool
    max_retries: int
    notify_on_failure: bool
    notification_emails: Optional[List[str]] = []  # List instead of JSON string for API response
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ExecutionHistoryEntry(BaseModel):
    id: int
    execution_time: datetime
    success: bool
    error_message: Optional[str] = None
    printers_processed: int
    printers_successful: int
    printers_failed: int
    total_reports_created: int
    execution_duration_seconds: Optional[float] = None
    retry_count: int = 0
    details: Optional[str] = None  # JSON con detalles por impresora

    class Config:
        from_attributes = True

class ExecutionHistory(BaseModel):
    schedule_id: int
    schedule_name: str
    total_executions: int
    recent_executions: List[ExecutionHistoryEntry]
    success_rate: float
    average_duration: Optional[float] = None
    id: int
    name: str
    description: Optional[str]
    schedule_type: str
    interval_minutes: Optional[int]
    cron_expression: Optional[str]
    time_of_day: Optional[str]
    day_of_week: Optional[int]
    day_of_month: Optional[int]
    target_type: str
    printer_ids: Optional[List[int]]
    is_active: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    run_count: int
    error_count: int
    last_error: Optional[str]
    retry_on_failure: bool
    max_retries: int
    notify_on_failure: bool
    notification_emails: Optional[List[str]]
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ScheduleRunResult(BaseModel):
    schedule_id: int
    success: bool
    message: str
    printers_polled: int
    errors: List[str]
    execution_time: float

# Helper functions
def serialize_printer_ids(printer_ids: List[int]) -> str:
    """Convert list of printer IDs to JSON string"""
    return json.dumps(printer_ids) if printer_ids else None

def deserialize_printer_ids(printer_ids_json: str) -> List[int]:
    """Convert JSON string to list of printer IDs"""
    try:
        return json.loads(printer_ids_json) if printer_ids_json else []
    except (json.JSONDecodeError, TypeError):
        return []

def serialize_emails(emails: List[str]) -> str:
    """Convert list of emails to JSON string"""
    return json.dumps(emails) if emails else None

def deserialize_emails(emails_json: str) -> List[str]:
    """Convert JSON string to list of emails"""
    try:
        return json.loads(emails_json) if emails_json else []
    except (json.JSONDecodeError, TypeError):
        return []

def calculate_next_run(schedule: CounterSchedule) -> Optional[datetime]:
    """Calculate next run time based on schedule configuration"""
    now = datetime.utcnow()
    
    if schedule.schedule_type == "interval" and schedule.interval_minutes:
        return now + timedelta(minutes=schedule.interval_minutes)
    
    elif schedule.schedule_type == "daily" and schedule.time_of_day:
        try:
            hour, minute = map(int, schedule.time_of_day.split(':'))
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
            return next_run
        except ValueError:
            return None
    
    elif schedule.schedule_type == "weekly" and schedule.time_of_day and schedule.day_of_week is not None:
        try:
            hour, minute = map(int, schedule.time_of_day.split(':'))
            days_ahead = schedule.day_of_week - now.weekday()
            if days_ahead <= 0:  # Target day already happened this week
                days_ahead += 7
            next_run = now + timedelta(days=days_ahead)
            next_run = next_run.replace(hour=hour, minute=minute, second=0, microsecond=0)
            return next_run
        except ValueError:
            return None
    
    elif schedule.schedule_type == "monthly" and schedule.time_of_day and schedule.day_of_month:
        try:
            hour, minute = map(int, schedule.time_of_day.split(':'))
            next_run = now.replace(day=schedule.day_of_month, hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                # Move to next month
                if now.month == 12:
                    next_run = next_run.replace(year=now.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=now.month + 1)
            return next_run
        except ValueError:
            return None
    
    return None

async def execute_schedule(schedule_id: int, db: Session) -> ScheduleRunResult:
    """Execute a counter schedule and poll the specified printers"""
    from ..models import CounterScheduleExecution
    start_time = datetime.utcnow()
    errors = []
    printers_polled = 0
    printers_successful = 0
    printers_failed = 0
    total_reports_created = 0
    execution_details = []
    
    try:
        # Get the schedule
        schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
        if not schedule:
            return ScheduleRunResult(
                schedule_id=schedule_id,
                success=False,
                message="Schedule not found",
                printers_polled=0,
                errors=["Schedule not found"],
                execution_time=0.0
            )
        
        # Get target printers
        if schedule.target_type == "all":
            printers = db.query(Printer).filter(Printer.status == "active").all()
        elif schedule.target_type == "selection":
            printer_ids = deserialize_printer_ids(schedule.printer_ids)
            printers = db.query(Printer).filter(
                and_(Printer.id.in_(printer_ids), Printer.status == "active")
            ).all()
        else:  # single
            printer_ids = deserialize_printer_ids(schedule.printer_ids)
            if printer_ids:
                printers = db.query(Printer).filter(
                    and_(Printer.id == printer_ids[0], Printer.status == "active")
                ).all()
            else:
                printers = []
        
        if not printers:
            execution_duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Crear registro de ejecución fallida
            execution_record = CounterScheduleExecution(
                schedule_id=schedule_id,
                success=False,
                error_message="No active printers found for this schedule",
                printers_processed=0,
                printers_successful=0,
                printers_failed=0,
                total_reports_created=0,
                execution_duration_seconds=execution_duration,
                retry_count=0,
                details=json.dumps({"message": "No active printers found"})
            )
            db.add(execution_record)
            db.commit()
            
            return ScheduleRunResult(
                schedule_id=schedule_id,
                success=False,
                message="No active printers found for this schedule",
                printers_polled=0,
                errors=["No active printers found"],
                execution_time=execution_duration
            )
        
        # Initialize SNMP service
        snmp_service = SNMPService()
        
        # Poll each printer
        for printer in printers:
            try:
                # Check if we already have a counter record for this month
                now = datetime.utcnow()
                existing_counter = db.query(MonthlyCounter).filter(
                    MonthlyCounter.printer_id == printer.id,
                    MonthlyCounter.year == now.year,
                    MonthlyCounter.month == now.month
                ).first()
                
                if existing_counter and existing_counter.locked:
                    error_msg = f"Counter for printer {printer.id} ({printer.ip}) already exists and is locked for {now.year}-{now.month:02d}"
                    errors.append(error_msg)
                    execution_details.append({
                        "printer_id": printer.id,
                        "printer_ip": printer.ip,
                        "success": False,
                        "error": error_msg
                    })
                    printers_failed += 1
                    continue
                
                # Poll the printer for counter data
                from .counter_collection import get_printer_counters_via_snmp, create_or_update_monthly_counter
                
                snmp_result = get_printer_counters_via_snmp(printer.ip, printer.snmp_profile)
                
                if snmp_result['success']:
                    counters = snmp_result['counters']
                    
                    # Create or update MonthlyCounter record
                    action, counter_record = create_or_update_monthly_counter(
                        printer_id=printer.id,
                        counter_bw=counters['bw_counter'],
                        counter_color=counters['color_counter'],
                        counter_total=counters['total_counter'],
                        db=db
                    )
                    
                    printers_polled += 1
                    printers_successful += 1
                    if action in ["created", "updated"]:
                        total_reports_created += 1
                    
                    execution_details.append({
                        "printer_id": printer.id,
                        "printer_ip": printer.ip,
                        "success": True,
                        "action": action,
                        "counters": counters,
                        "response_time": snmp_result['response_time']
                    })
                    
                else:
                    # SNMP failed
                    error_msg = f"SNMP failed for printer {printer.id} ({printer.ip}): {snmp_result['error']}"
                    errors.append(error_msg)
                    execution_details.append({
                        "printer_id": printer.id,
                        "printer_ip": printer.ip,
                        "success": False,
                        "error": snmp_result['error']
                    })
                    printers_failed += 1
                
            except Exception as e:
                error_msg = f"Error polling printer {printer.id} ({printer.ip}): {str(e)}"
                errors.append(error_msg)
                execution_details.append({
                    "printer_id": printer.id,
                    "printer_ip": printer.ip,
                    "success": False,
                    "error": error_msg
                })
                printers_failed += 1
                continue
        
        # Update schedule statistics
        schedule.last_run = datetime.utcnow()
        schedule.next_run = calculate_next_run(schedule)
        schedule.run_count += 1
        
        if errors:
            schedule.error_count += 1
            schedule.last_error = "; ".join(errors[:3])  # Store first 3 errors
        else:
            schedule.last_error = None
        
        execution_duration = (datetime.utcnow() - start_time).total_seconds()
        
        # Crear registro de ejecución
        execution_record = CounterScheduleExecution(
            schedule_id=schedule_id,
            success=len(errors) == 0,
            error_message="; ".join(errors) if errors else None,
            printers_processed=len(printers),
            printers_successful=printers_successful,
            printers_failed=printers_failed,
            total_reports_created=total_reports_created,
            execution_duration_seconds=execution_duration,
            retry_count=0,
            details=json.dumps(execution_details)
        )
        db.add(execution_record)
        
        db.commit()
        
        return ScheduleRunResult(
            schedule_id=schedule_id,
            success=len(errors) == 0,
            message=f"Successfully polled {printers_polled} printers" if len(errors) == 0 else f"Polled {printers_polled} printers with {len(errors)} errors",
            printers_polled=printers_polled,
            errors=errors,
            execution_time=execution_duration
        )
        
    except Exception as e:
        execution_duration = (datetime.utcnow() - start_time).total_seconds()
        
        # Crear registro de ejecución fallida
        execution_record = CounterScheduleExecution(
            schedule_id=schedule_id,
            success=False,
            error_message=str(e),
            printers_processed=0,
            printers_successful=0,
            printers_failed=0,
            total_reports_created=0,
            execution_duration_seconds=execution_duration,
            retry_count=0,
            details=json.dumps({"error": str(e)})
        )
        db.add(execution_record)
        db.commit()
        
        return ScheduleRunResult(
            schedule_id=schedule_id,
            success=False,
            message=f"Execution failed: {str(e)}",
            printers_polled=printers_polled,
            errors=[str(e)],
            execution_time=execution_duration
        )

# API Endpoints
@router.get("/", response_model=List[CounterScheduleResponse])
def list_schedules(db: Session = Depends(get_db)):
    """List all counter schedules"""
    schedules = db.query(CounterSchedule).all()
    
    # Convert JSON fields back to lists
    result = []
    for schedule in schedules:
        schedule_dict = schedule.__dict__.copy()
        schedule_dict['printer_ids'] = deserialize_printer_ids(schedule.printer_ids)
        schedule_dict['notification_emails'] = deserialize_emails(schedule.notification_emails)
        result.append(CounterScheduleResponse(**schedule_dict))
    
    return result

@router.post("/", response_model=CounterScheduleResponse)
def create_schedule(schedule: CounterScheduleCreate, db: Session = Depends(get_db)):
    """Create a new counter schedule"""
    
    # Validate schedule configuration
    if schedule.schedule_type == "interval" and not schedule.interval_minutes:
        raise HTTPException(status_code=400, detail="interval_minutes is required for interval schedules")
    
    if schedule.schedule_type in ["daily", "weekly", "monthly"] and not schedule.time_of_day:
        raise HTTPException(status_code=400, detail="time_of_day is required for daily/weekly/monthly schedules")
    
    if schedule.schedule_type == "weekly" and schedule.day_of_week is None:
        raise HTTPException(status_code=400, detail="day_of_week is required for weekly schedules")
    
    if schedule.schedule_type == "monthly" and not schedule.day_of_month:
        raise HTTPException(status_code=400, detail="day_of_month is required for monthly schedules")
    
    if schedule.target_type in ["selection", "single"] and not schedule.printer_ids:
        raise HTTPException(status_code=400, detail="printer_ids is required for selection/single target types")
    
    # Create the schedule
    db_schedule = CounterSchedule(
        name=schedule.name,
        description=schedule.description,
        schedule_type=schedule.schedule_type,
        interval_minutes=schedule.interval_minutes,
        cron_expression=schedule.cron_expression,
        time_of_day=schedule.time_of_day,
        day_of_week=schedule.day_of_week,
        day_of_month=schedule.day_of_month,
        target_type=schedule.target_type,
        printer_ids=serialize_printer_ids(schedule.printer_ids),
        is_active=schedule.is_active,
        retry_on_failure=schedule.retry_on_failure,
        max_retries=schedule.max_retries,
        notify_on_failure=schedule.notify_on_failure,
        notification_emails=serialize_emails(schedule.notification_emails),
        created_by=schedule.created_by
    )
    
    # Calculate next run
    db_schedule.next_run = calculate_next_run(db_schedule)
    
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    # Convert for response
    schedule_dict = db_schedule.__dict__.copy()
    schedule_dict['printer_ids'] = deserialize_printer_ids(db_schedule.printer_ids)
    schedule_dict['notification_emails'] = deserialize_emails(db_schedule.notification_emails)
    
    return CounterScheduleResponse(**schedule_dict)

@router.get("/{schedule_id}", response_model=CounterScheduleResponse)
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Get a specific counter schedule"""
    schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Convert for response
    schedule_dict = schedule.__dict__.copy()
    schedule_dict['printer_ids'] = deserialize_printer_ids(schedule.printer_ids)
    schedule_dict['notification_emails'] = deserialize_emails(schedule.notification_emails)
    
    return CounterScheduleResponse(**schedule_dict)

@router.put("/{schedule_id}", response_model=CounterScheduleResponse)
def update_schedule(schedule_id: int, schedule_update: CounterScheduleUpdate, db: Session = Depends(get_db)):
    """Update a counter schedule"""
    schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Update fields
    update_data = schedule_update.dict(exclude_unset=True)
    
    # Handle JSON fields
    if 'printer_ids' in update_data:
        update_data['printer_ids'] = serialize_printer_ids(update_data['printer_ids'])
    
    if 'notification_emails' in update_data:
        update_data['notification_emails'] = serialize_emails(update_data['notification_emails'])
    
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    # Recalculate next run if schedule configuration changed
    if any(field in update_data for field in ['schedule_type', 'interval_minutes', 'time_of_day', 'day_of_week', 'day_of_month']):
        schedule.next_run = calculate_next_run(schedule)
    
    db.commit()
    db.refresh(schedule)
    
    # Convert for response
    schedule_dict = schedule.__dict__.copy()
    schedule_dict['printer_ids'] = deserialize_printer_ids(schedule.printer_ids)
    schedule_dict['notification_emails'] = deserialize_emails(schedule.notification_emails)
    
    return CounterScheduleResponse(**schedule_dict)

@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Delete a counter schedule"""
    schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    return {"message": "Schedule deleted successfully"}

@router.post("/{schedule_id}/run", response_model=ScheduleRunResult)
async def run_schedule_now(schedule_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Execute a schedule immediately"""
    schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Execute the schedule
    result = await execute_schedule(schedule_id, db)
    return result

@router.post("/{schedule_id}/toggle")
def toggle_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Toggle schedule active status"""
    schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule.is_active = not schedule.is_active
    
    # Recalculate next run if activated
    if schedule.is_active:
        schedule.next_run = calculate_next_run(schedule)
    else:
        schedule.next_run = None
    
    db.commit()
    
    return {"message": f"Schedule {'activated' if schedule.is_active else 'deactivated'} successfully"}

@router.get("/{schedule_id}/history")
async def get_schedule_history(
    schedule_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Obtener historial de ejecuciones de un schedule específico"""
    from ..models import CounterScheduleExecution
    
    # Verificar que el schedule existe
    schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Counter schedule not found")
    
    # Obtener historial de ejecuciones
    executions = db.query(CounterScheduleExecution).filter(
        CounterScheduleExecution.schedule_id == schedule_id
    ).order_by(CounterScheduleExecution.execution_time.desc()).limit(limit).all()
    
    # Calcular estadísticas
    total_executions = len(executions)
    successful_executions = sum(1 for exec in executions if exec.success)
    success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
    
    # Calcular duración promedio
    durations = [exec.execution_duration_seconds for exec in executions if exec.execution_duration_seconds is not None]
    average_duration = sum(durations) / len(durations) if durations else None
    
    # Convertir a formato de respuesta
    execution_entries = []
    for exec in executions:
        execution_entries.append({
            "id": exec.id,
            "execution_time": exec.execution_time,
            "success": exec.success,
            "error_message": exec.error_message,
            "printers_processed": exec.printers_processed,
            "printers_successful": exec.printers_successful,
            "printers_failed": exec.printers_failed,
            "total_reports_created": exec.total_reports_created,
            "execution_duration_seconds": exec.execution_duration_seconds,
            "retry_count": exec.retry_count,
            "details": exec.details
        })
    
    return {
        "schedule_id": schedule_id,
        "schedule_name": schedule.name,
        "total_executions": total_executions,
        "recent_executions": execution_entries,
        "success_rate": success_rate,
        "average_duration": average_duration
    }