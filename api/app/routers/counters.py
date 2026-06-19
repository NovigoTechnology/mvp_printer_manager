from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, time
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
import traceback
import json

from ..db import get_db
from ..models import MonthlyCounter, Printer, CounterLocationExportHistory
from ..services.snmp import SNMPService
from ..services.export_service import ExportService
from ..services.location_counter_sync import sync_location_segments_for_printer_month

router = APIRouter()

class MonthlyCounterCreate(BaseModel):
    printer_id: int
    year: int
    month: int
    counter_bw: int
    counter_color: int
    counter_total: int
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None

class MonthlyCounterUpdate(BaseModel):
    counter_bw: int
    counter_color: int
    counter_total: int
    notes: Optional[str] = None

class PrinterSummary(BaseModel):
    brand: str
    model: str
    ip: str
    location: Optional[str] = None
    asset_tag: Optional[str] = None
    serial_number: Optional[str] = None

class MonthlyCounterResponse(BaseModel):
    id: int
    printer_id: int
    printer: PrinterSummary
    year: int
    month: int
    counter_bw: int
    counter_color: int
    counter_total: int
    previous_counter_bw: int
    previous_counter_color: int
    previous_counter_total: int
    pages_printed_bw: int
    pages_printed_color: int
    pages_printed_total: int
    location_snapshot: Optional[str] = None
    notes: Optional[str] = None
    locked: bool = True
    recorded_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LocationExportHistoryResponse(BaseModel):
    id: int
    exported_at: datetime
    year: Optional[int] = None
    month: Optional[int] = None
    total_locations: int
    total_pages: int
    filename: Optional[str] = None
    requested_by: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    filters: Optional[str] = None

    class Config:
        from_attributes = True


class ConsolidatedExportRequest(BaseModel):
    counter_ids: List[int]


class ConsolidatedExportRow(BaseModel):
    asset_tag: str
    marca: str
    modelo: str
    ip: str
    ubicacion: str
    year: int
    month: int
    month_name: str
    previous_counter_bw: int
    previous_counter_color: int
    previous_counter_total: int
    current_counter_bw: int
    current_counter_color: int
    current_counter_total: int
    total_pages_bw: int
    total_pages_color: int
    total_pages: int
    readings_count: int
    last_reading_date: Optional[str] = None


MONTH_NAMES_ES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
}

def calculate_pages_printed(current: int, previous: int) -> int:
    """Calculate pages printed, ensuring non-negative result"""
    return max(0, current - previous)

def get_previous_counter(db: Session, printer_id: int, exclude_counter_id: int = None) -> Optional[MonthlyCounter]:
    """Get the most recent previous counter for a printer by recorded_at date"""
    query = db.query(MonthlyCounter).filter(
        MonthlyCounter.printer_id == printer_id
    )
    
    # Exclude current counter if updating
    if exclude_counter_id:
        query = query.filter(MonthlyCounter.id != exclude_counter_id)
    
    return query.order_by(MonthlyCounter.recorded_at.desc()).first()


@router.post("/export/consolidated-data", response_model=List[ConsolidatedExportRow])
def get_consolidated_export_data(
    payload: ConsolidatedExportRequest = Body(...),
    db: Session = Depends(get_db),
):
    """Return consolidated monthly counter rows by printer and period for export."""

    if not payload.counter_ids:
        return []

    counters = (
        db.query(MonthlyCounter)
        .filter(MonthlyCounter.id.in_(payload.counter_ids))
        .all()
    )

    if not counters:
        return []

    grouped: Dict[str, List[MonthlyCounter]] = {}
    for row in counters:
        key = f"{row.printer_id}-{row.year}-{row.month}"
        grouped.setdefault(key, []).append(row)

    result: List[ConsolidatedExportRow] = []
    for group_rows in grouped.values():
        ordered = sorted(
            group_rows,
            key=lambda x: x.recorded_at or x.created_at,
        )

        first = ordered[0]
        last = ordered[-1]
        printer = db.query(Printer).filter(Printer.id == last.printer_id).first()

        if not printer:
            continue

        total_bw = sum(item.pages_printed_bw or 0 for item in ordered)
        total_color = sum(item.pages_printed_color or 0 for item in ordered)
        total_pages = sum(item.pages_printed_total or 0 for item in ordered)

        result.append(
            ConsolidatedExportRow(
                asset_tag=printer.asset_tag or "",
                marca=printer.brand,
                modelo=printer.model,
                ip=printer.ip,
                ubicacion=printer.location or "",
                year=last.year,
                month=last.month,
                month_name=MONTH_NAMES_ES.get(last.month, str(last.month)),
                previous_counter_bw=first.previous_counter_bw or 0,
                previous_counter_color=first.previous_counter_color or 0,
                previous_counter_total=first.previous_counter_total or 0,
                current_counter_bw=last.counter_bw or 0,
                current_counter_color=last.counter_color or 0,
                current_counter_total=last.counter_total or 0,
                total_pages_bw=total_bw,
                total_pages_color=total_color,
                total_pages=total_pages,
                readings_count=len(ordered),
                last_reading_date=(last.recorded_at or last.created_at).strftime("%d/%m/%Y") if (last.recorded_at or last.created_at) else None,
            )
        )

    result.sort(key=lambda x: (x.year, x.month, x.asset_tag), reverse=True)
    return result

@router.get("/", response_model=List[MonthlyCounterResponse])
def get_monthly_counters(
    year: Optional[int] = None,
    month: Optional[int] = None,
    printer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get monthly counters with optional filters"""
    query = db.query(MonthlyCounter)
    
    if year:
        query = query.filter(MonthlyCounter.year == year)
    if month:
        query = query.filter(MonthlyCounter.month == month)
    if printer_id:
        query = query.filter(MonthlyCounter.printer_id == printer_id)
    
    counters = query.order_by(MonthlyCounter.year.desc(), MonthlyCounter.month.desc()).all()
    
    # Build response with printer info
    result = []
    for counter in counters:
        printer = db.query(Printer).filter(Printer.id == counter.printer_id).first()
        if printer:
            printer_summary = PrinterSummary(
                brand=printer.brand,
                model=printer.model,
                ip=printer.ip,
                location=printer.location,
                asset_tag=printer.asset_tag,
                serial_number=printer.serial_number
            )
            
            counter_response = MonthlyCounterResponse(
                id=counter.id,
                printer_id=counter.printer_id,
                printer=printer_summary,
                year=counter.year,
                month=counter.month,
                counter_bw=counter.counter_bw,
                counter_color=counter.counter_color,
                counter_total=counter.counter_total,
                previous_counter_bw=counter.previous_counter_bw,
                previous_counter_color=counter.previous_counter_color,
                previous_counter_total=counter.previous_counter_total,
                pages_printed_bw=counter.pages_printed_bw,
                pages_printed_color=counter.pages_printed_color,
                pages_printed_total=counter.pages_printed_total,
                location_snapshot=counter.location_snapshot,
                notes=counter.notes,
                recorded_at=counter.recorded_at,
                created_at=counter.created_at,
                updated_at=counter.updated_at
            )
            result.append(counter_response)
    
    return result

@router.post("/", response_model=MonthlyCounterResponse)
def create_monthly_counter(counter: MonthlyCounterCreate, db: Session = Depends(get_db)):
    """Create a new monthly counter record"""
    
    # Check if printer exists
    printer = db.query(Printer).filter(Printer.id == counter.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Check if counter already exists for this printer/month/year
    existing = db.query(MonthlyCounter).filter(
        MonthlyCounter.printer_id == counter.printer_id,
        MonthlyCounter.year == counter.year,
        MonthlyCounter.month == counter.month
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Counter record already exists for this printer in {counter.month}/{counter.year}"
        )
    
    # Get previous counter for calculations (most recent by date)
    prev_counter = get_previous_counter(db, counter.printer_id)
    
    # Set previous counters and calculate pages printed
    previous_bw = prev_counter.counter_bw if prev_counter else 0
    previous_color = prev_counter.counter_color if prev_counter else 0
    previous_total = prev_counter.counter_total if prev_counter else 0
    
    pages_bw = calculate_pages_printed(counter.counter_bw, previous_bw)
    pages_color = calculate_pages_printed(counter.counter_color, previous_color)
    pages_total = calculate_pages_printed(counter.counter_total, previous_total)
    
    # Create new counter record
    db_counter = MonthlyCounter(
        printer_id=counter.printer_id,
        year=counter.year,
        month=counter.month,
        counter_bw=counter.counter_bw,
        counter_color=counter.counter_color,
        counter_total=counter.counter_total,
        previous_counter_bw=previous_bw,
        previous_counter_color=previous_color,
        previous_counter_total=previous_total,
        pages_printed_bw=pages_bw,
        pages_printed_color=pages_color,
        pages_printed_total=pages_total,
        location_snapshot=printer.location,
        notes=counter.notes
    )
    
    # Set custom recorded_at if provided, otherwise it will use server default (now())
    if counter.recorded_at:
        db_counter.recorded_at = counter.recorded_at
    
    db.add(db_counter)
    sync_location_segments_for_printer_month(db, counter.printer_id, counter.year, counter.month)
    db.commit()
    db.refresh(db_counter)
    
    # Return response with printer info
    printer_summary = PrinterSummary(
        brand=printer.brand,
        model=printer.model,
        ip=printer.ip,
        location=printer.location,
        asset_tag=printer.asset_tag,
        serial_number=printer.serial_number
    )
    
    return MonthlyCounterResponse(
        id=db_counter.id,
        printer_id=db_counter.printer_id,
        printer=printer_summary,
        year=db_counter.year,
        month=db_counter.month,
        counter_bw=db_counter.counter_bw,
        counter_color=db_counter.counter_color,
        counter_total=db_counter.counter_total,
        previous_counter_bw=db_counter.previous_counter_bw,
        previous_counter_color=db_counter.previous_counter_color,
        previous_counter_total=db_counter.previous_counter_total,
        pages_printed_bw=db_counter.pages_printed_bw,
        pages_printed_color=db_counter.pages_printed_color,
        pages_printed_total=db_counter.pages_printed_total,
        location_snapshot=db_counter.location_snapshot,
        notes=db_counter.notes,
        recorded_at=db_counter.recorded_at,
        created_at=db_counter.created_at,
        updated_at=db_counter.updated_at
    )

@router.put("/{counter_id}", response_model=MonthlyCounterResponse)
def update_monthly_counter(
    counter_id: int, 
    counter_update: MonthlyCounterUpdate, 
    db: Session = Depends(get_db)
):
    """Update an existing monthly counter record"""
    
    db_counter = db.query(MonthlyCounter).filter(MonthlyCounter.id == counter_id).first()
    if not db_counter:
        raise HTTPException(status_code=404, detail="Counter record not found")
    
    # Check if counter is locked
    if db_counter.locked:
        raise HTTPException(status_code=403, detail="Counter record is locked. Unlock it first to edit.")
    
    # Get printer info
    printer = db.query(Printer).filter(Printer.id == db_counter.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Recalculate previous counters (get most recent by date, excluding current record)
    prev_counter = get_previous_counter(db, db_counter.printer_id, db_counter.id)
    
    # Update previous counters
    previous_bw = prev_counter.counter_bw if prev_counter else 0
    previous_color = prev_counter.counter_color if prev_counter else 0
    previous_total = prev_counter.counter_total if prev_counter else 0
    
    # Recalculate pages printed with new values and updated previous counters
    pages_bw = calculate_pages_printed(counter_update.counter_bw, previous_bw)
    pages_color = calculate_pages_printed(counter_update.counter_color, previous_color)
    pages_total = calculate_pages_printed(counter_update.counter_total, previous_total)
    
    # Update the record
    db_counter.counter_bw = counter_update.counter_bw
    db_counter.counter_color = counter_update.counter_color
    db_counter.counter_total = counter_update.counter_total
    db_counter.previous_counter_bw = previous_bw
    db_counter.previous_counter_color = previous_color
    db_counter.previous_counter_total = previous_total
    db_counter.pages_printed_bw = pages_bw
    db_counter.pages_printed_color = pages_color
    db_counter.pages_printed_total = pages_total
    db_counter.notes = counter_update.notes
    
    sync_location_segments_for_printer_month(db, db_counter.printer_id, db_counter.year, db_counter.month)
    db.commit()
    db.refresh(db_counter)
    
    # Return response with printer info
    printer_summary = PrinterSummary(
        brand=printer.brand,
        model=printer.model,
        ip=printer.ip,
        location=printer.location,
        asset_tag=printer.asset_tag,
        serial_number=printer.serial_number
    )
    
    return MonthlyCounterResponse(
        id=db_counter.id,
        printer_id=db_counter.printer_id,
        printer=printer_summary,
        year=db_counter.year,
        month=db_counter.month,
        counter_bw=db_counter.counter_bw,
        counter_color=db_counter.counter_color,
        counter_total=db_counter.counter_total,
        previous_counter_bw=db_counter.previous_counter_bw,
        previous_counter_color=db_counter.previous_counter_color,
        previous_counter_total=db_counter.previous_counter_total,
        pages_printed_bw=db_counter.pages_printed_bw,
        pages_printed_color=db_counter.pages_printed_color,
        pages_printed_total=db_counter.pages_printed_total,
        location_snapshot=db_counter.location_snapshot,
        notes=db_counter.notes,
        recorded_at=db_counter.recorded_at,
        created_at=db_counter.created_at,
        updated_at=db_counter.updated_at
    )

@router.delete("/{counter_id}")
def delete_monthly_counter(counter_id: int, db: Session = Depends(get_db)):
    """Delete a monthly counter record"""
    
    db_counter = db.query(MonthlyCounter).filter(MonthlyCounter.id == counter_id).first()
    if not db_counter:
        raise HTTPException(status_code=404, detail="Counter record not found")

    target_printer = db_counter.printer_id
    target_year = db_counter.year
    target_month = db_counter.month
    
    db.delete(db_counter)
    sync_location_segments_for_printer_month(db, target_printer, target_year, target_month)
    db.commit()
    
    return {"message": "Counter record deleted successfully"}

@router.get("/summary/{printer_id}")
def get_printer_counter_summary(printer_id: int, db: Session = Depends(get_db)):
    """Get counter summary for a specific printer"""
    
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Get last 12 months of counters
    counters = db.query(MonthlyCounter).filter(
        MonthlyCounter.printer_id == printer_id
    ).order_by(MonthlyCounter.year.desc(), MonthlyCounter.month.desc()).limit(12).all()
    
    # Calculate totals
    total_pages_bw = sum(counter.pages_printed_bw for counter in counters)
    total_pages_color = sum(counter.pages_printed_color for counter in counters)
    total_pages = sum(counter.pages_printed_total for counter in counters)
    
    return {
        "printer_id": printer_id,
        "printer_name": f"{printer.brand} {printer.model}",
        "total_pages_bw": total_pages_bw,
        "total_pages_color": total_pages_color,
        "total_pages": total_pages,
        "months_recorded": len(counters),
        "latest_counter": counters[0] if counters else None
    }

@router.get("/summary-by-location")
def get_counter_summary_by_location(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get aggregated printed volume by location snapshot."""

    query = db.query(
        func.coalesce(MonthlyCounter.location_snapshot, "Sin ubicacion").label("location"),
        func.sum(MonthlyCounter.pages_printed_bw).label("total_pages_bw"),
        func.sum(MonthlyCounter.pages_printed_color).label("total_pages_color"),
        func.sum(MonthlyCounter.pages_printed_total).label("total_pages")
    )

    if year:
        query = query.filter(MonthlyCounter.year == year)
    if month:
        query = query.filter(MonthlyCounter.month == month)

    rows = query.group_by(
        func.coalesce(MonthlyCounter.location_snapshot, "Sin ubicacion")
    ).order_by(
        func.sum(MonthlyCounter.pages_printed_total).desc()
    ).all()

    return {
        "year": year,
        "month": month,
        "locations": [
            {
                "location": row.location,
                "total_pages_bw": int(row.total_pages_bw or 0),
                "total_pages_color": int(row.total_pages_color or 0),
                "total_pages": int(row.total_pages or 0)
            }
            for row in rows
        ]
    }


@router.get("/summary-by-location/export-excel")
def export_counter_summary_by_location_excel(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    requested_by: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Export location-based monthly counter summary to Excel and save export history."""

    query = db.query(
        func.coalesce(MonthlyCounter.location_snapshot, "Sin ubicacion").label("location"),
        func.sum(MonthlyCounter.pages_printed_bw).label("total_pages_bw"),
        func.sum(MonthlyCounter.pages_printed_color).label("total_pages_color"),
        func.sum(MonthlyCounter.pages_printed_total).label("total_pages")
    )

    if year:
        query = query.filter(MonthlyCounter.year == year)
    if month:
        query = query.filter(MonthlyCounter.month == month)

    rows = query.group_by(
        func.coalesce(MonthlyCounter.location_snapshot, "Sin ubicacion")
    ).order_by(
        func.sum(MonthlyCounter.pages_printed_total).desc()
    ).all()

    rows_data = [
        {
            "location": row.location,
            "total_pages_bw": int(row.total_pages_bw or 0),
            "total_pages_color": int(row.total_pages_color or 0),
            "total_pages": int(row.total_pages or 0)
        }
        for row in rows
    ]

    period_suffix = ""
    if year and month:
        period_suffix = f"_{year}_{month:02d}"
    elif year:
        period_suffix = f"_{year}"

    filename = f"contadores_ubicacion{period_suffix}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    total_pages = sum(item["total_pages"] for item in rows_data)

    try:
        export_service = ExportService()
        excel_buffer = export_service.export_location_monthly_counters_to_excel(rows_data, year=year, month=month)

        history = CounterLocationExportHistory(
            year=year,
            month=month,
            total_locations=len(rows_data),
            total_pages=total_pages,
            filename=filename,
            requested_by=requested_by,
            status="success",
            filters=json.dumps({"year": year, "month": month})
        )
        db.add(history)
        db.commit()

        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        db.rollback()

        failed_history = CounterLocationExportHistory(
            year=year,
            month=month,
            total_locations=len(rows_data),
            total_pages=total_pages,
            filename=filename,
            requested_by=requested_by,
            status="error",
            error_message=str(e),
            filters=json.dumps({"year": year, "month": month})
        )
        db.add(failed_history)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exportando resumen por ubicación: {str(e)}"
        )


@router.get("/summary-by-location/export-history", response_model=List[LocationExportHistoryResponse])
def get_counter_summary_by_location_export_history(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get history of exports for monthly counters by location."""

    history = db.query(CounterLocationExportHistory).order_by(
        CounterLocationExportHistory.exported_at.desc()
    ).limit(limit).all()

    return history

@router.patch("/{counter_id}/toggle-lock", response_model=MonthlyCounterResponse)
def toggle_counter_lock(counter_id: int, db: Session = Depends(get_db)):
    """Toggle the lock status of a monthly counter record"""
    
    db_counter = db.query(MonthlyCounter).filter(MonthlyCounter.id == counter_id).first()
    if not db_counter:
        raise HTTPException(status_code=404, detail="Counter record not found")
    
    # Get printer info
    printer = db.query(Printer).filter(Printer.id == db_counter.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Toggle lock status
    db_counter.locked = not db_counter.locked
    
    db.commit()
    db.refresh(db_counter)
    
    # Return response with printer info
    printer_summary = PrinterSummary(
        brand=printer.brand,
        model=printer.model,
        ip=printer.ip,
        location=printer.location,
        asset_tag=printer.asset_tag,
        serial_number=printer.serial_number
    )
    
    return MonthlyCounterResponse(
        id=db_counter.id,
        printer_id=db_counter.printer_id,
        printer=printer_summary,
        year=db_counter.year,
        month=db_counter.month,
        counter_bw=db_counter.counter_bw,
        counter_color=db_counter.counter_color,
        counter_total=db_counter.counter_total,
        previous_counter_bw=db_counter.previous_counter_bw,
        previous_counter_color=db_counter.previous_counter_color,
        previous_counter_total=db_counter.previous_counter_total,
        pages_printed_bw=db_counter.pages_printed_bw,
        pages_printed_color=db_counter.pages_printed_color,
        pages_printed_total=db_counter.pages_printed_total,
        location_snapshot=db_counter.location_snapshot,
        notes=db_counter.notes,
        locked=db_counter.locked,
        recorded_at=db_counter.recorded_at,
        created_at=db_counter.created_at,
        updated_at=db_counter.updated_at
    )

# ============================================================================
# AUTO COUNTER MODULE - Módulo de Toma Automática de Contadores
# ============================================================================

# Scheduler global para las lecturas automáticas
auto_scheduler = BackgroundScheduler()
auto_scheduler.start()

# Configuraciones activas en memoria
active_configs: Dict[int, 'AutoCounterConfig'] = {}

logger = logging.getLogger(__name__)

class AutoCounterConfig(BaseModel):
    id: Optional[int] = None
    name: str
    printer_ids: List[int]
    frequency: str  # 'daily', 'weekly', 'monthly'
    time_window_start: str  # HH:MM format
    time_window_end: str  # HH:MM format
    days_of_week: Optional[List[int]] = None  # 0=Monday, 6=Sunday for weekly
    day_of_month: Optional[int] = None  # For monthly
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class AutoCounterReading(BaseModel):
    id: Optional[int] = None
    config_id: int
    printer_id: int
    printer_name: str
    counter_bw: Optional[int] = None
    counter_color: Optional[int] = None
    counter_total: Optional[int] = None
    success: bool
    error_message: Optional[str] = None
    reading_time: datetime
    snmp_response_time: Optional[float] = None

class AutoCounterStats(BaseModel):
    total_configs: int
    active_configs: int
    total_readings_today: int
    successful_readings_today: int
    failed_readings_today: int
    success_rate_today: float
    last_execution: Optional[datetime] = None
    next_execution: Optional[datetime] = None

def get_printer_counters_via_snmp(printer_ip: str) -> Dict[str, Any]:
    """Obtiene los contadores de una impresora via SNMP"""
    try:
        start_time = datetime.now()
        
        # Usar el servicio SNMP existente
        snmp_service = SNMPService()
        
        # Intentar con diferentes perfiles para obtener contadores
        profiles = ['hp', 'oki', 'brother', 'generic_v2c']
        
        best_result = None
        for profile in profiles:
            try:
                # Obtener OIDs específicos para contadores de páginas
                if profile == 'hp':
                    bw_oid = '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.1'
                    color_oid = '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.2'
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'
                elif profile == 'oki':
                    bw_oid = '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.999.1'
                    color_oid = '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.999.2'
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'
                elif profile == 'brother':
                    bw_oid = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0'
                    color_oid = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11.0'
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'
                else:  # generic_v2c
                    bw_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'
                    color_oid = '1.3.6.1.2.1.43.10.2.1.4.1.2'
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'
                
                # Realizar las consultas SNMP
                bw_counter = snmp_service.get_snmp_value(printer_ip, bw_oid)
                color_counter = snmp_service.get_snmp_value(printer_ip, color_oid)
                total_counter = snmp_service.get_snmp_value(printer_ip, total_oid)
                
                # Convertir a enteros
                bw_value = int(bw_counter) if bw_counter and bw_counter.isdigit() else None
                color_value = int(color_counter) if color_counter and color_counter.isdigit() else None
                total_value = int(total_counter) if total_counter and total_counter.isdigit() else None
                
                # Si al menos un valor es válido, consideramos este perfil como exitoso
                if any(v is not None for v in [bw_value, color_value, total_value]):
                    best_result = {
                        'bw_counter': bw_value,
                        'color_counter': color_value,
                        'total_counter': total_value,
                        'profile_used': profile
                    }
                    break
                    
            except Exception as e:
                logger.warning(f"Error with profile {profile} for {printer_ip}: {e}")
                continue
        
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds()
        
        if best_result:
            return {
                'success': True,
                'counters': best_result,
                'response_time': response_time,
                'error': None
            }
        else:
            return {
                'success': False,
                'counters': {},
                'response_time': response_time,
                'error': 'No se pudo obtener contadores con ningún perfil SNMP'
            }
        
    except Exception as e:
        logger.error(f"SNMP error for printer {printer_ip}: {e}")
        return {
            'success': False,
            'counters': {},
            'response_time': None,
            'error': str(e)
        }

def execute_auto_reading(config_id: int, db: Session):
    """Ejecuta una lectura automática para una configuración"""
    try:
        config = active_configs.get(config_id)
        if not config:
            logger.error(f"Configuration {config_id} not found in active configs")
            return
        
        logger.info(f"Starting auto reading for config: {config.name}")
        
        # Obtener las impresoras
        printers = db.query(Printer).filter(Printer.id.in_(config.printer_ids)).all()
        
        for printer in printers:
            logger.info(f"Reading counters for printer: {printer.brand} {printer.model} ({printer.ip})")
            
            # Obtener contadores via SNMP
            snmp_result = get_printer_counters_via_snmp(printer.ip)
            
            # Crear registro de lectura
            reading = AutoCounterReading(
                config_id=config_id,
                printer_id=printer.id,
                printer_name=f"{printer.brand} {printer.model}",
                success=snmp_result['success'],
                error_message=snmp_result['error'],
                reading_time=datetime.now(),
                snmp_response_time=snmp_result['response_time']
            )
            
            if snmp_result['success']:
                counters = snmp_result['counters']
                reading.counter_bw = counters.get('bw_counter')
                reading.counter_color = counters.get('color_counter')
                reading.counter_total = counters.get('total_counter')
                
                logger.info(f"Successfully read counters: BW={reading.counter_bw}, "
                          f"Color={reading.counter_color}, Total={reading.counter_total}")
            else:
                logger.error(f"Failed to read counters: {reading.error_message}")
            
            # Aquí podrías almacenar las lecturas en base de datos si necesitas historial
            # Por ahora solo logueamos los resultados
            
    except Exception as e:
        logger.error(f"Error executing auto reading for config {config_id}: {e}")
        logger.error(traceback.format_exc())

def schedule_auto_reading(config: AutoCounterConfig):
    """Programa una lectura automática según la configuración"""
    try:
        job_id = f"auto_counter_{config.id}"
        
        # Remover job existente si existe
        try:
            auto_scheduler.remove_job(job_id)
        except:
            pass
        
        if not config.enabled:
            logger.info(f"Config {config.name} is disabled, not scheduling")
            return
        
        # Parsear ventana de tiempo
        start_time = datetime.strptime(config.time_window_start, "%H:%M").time()
        end_time = datetime.strptime(config.time_window_end, "%H:%M").time()
        
        # Crear trigger según frecuencia
        if config.frequency == 'daily':
            # Ejecutar diariamente en un momento aleatorio dentro de la ventana
            trigger = CronTrigger(
                hour=start_time.hour,
                minute=start_time.minute,
                timezone='America/Mexico_City'
            )
        elif config.frequency == 'weekly':
            # Ejecutar semanalmente en los días especificados
            day_of_week = ','.join(map(str, config.days_of_week)) if config.days_of_week else '0'
            trigger = CronTrigger(
                day_of_week=day_of_week,
                hour=start_time.hour,
                minute=start_time.minute,
                timezone='America/Mexico_City'
            )
        elif config.frequency == 'monthly':
            # Ejecutar mensualmente en el día especificado
            trigger = CronTrigger(
                day=config.day_of_month or 1,
                hour=start_time.hour,
                minute=start_time.minute,
                timezone='America/Mexico_City'
            )
        else:
            logger.error(f"Unknown frequency: {config.frequency}")
            return
        
        # Función que se ejecutará con la sesión de base de datos
        def job_function():
            from ..db import SessionLocal
            db = SessionLocal()
            try:
                execute_auto_reading(config.id, db)
            finally:
                db.close()
        
        # Programar el job
        auto_scheduler.add_job(
            job_function,
            trigger=trigger,
            id=job_id,
            name=f"Auto Counter: {config.name}",
            replace_existing=True
        )
        
        logger.info(f"Scheduled auto reading for config: {config.name}")
        
    except Exception as e:
        logger.error(f"Error scheduling auto reading for config {config.name}: {e}")

@router.get("/auto/stats", response_model=AutoCounterStats)
def get_auto_counter_stats(db: Session = Depends(get_db)):
    """Obtiene estadísticas del módulo de contadores automáticos"""
    
    # Calcular estadísticas básicas
    total_configs = len(active_configs)
    active_configs_count = sum(1 for config in active_configs.values() if config.enabled)
    
    # Para las estadísticas de lecturas, por ahora devolvemos valores mock
    # En una implementación completa, estos datos vendrían de la base de datos
    return AutoCounterStats(
        total_configs=total_configs,
        active_configs=active_configs_count,
        total_readings_today=0,  # Mock data
        successful_readings_today=0,  # Mock data
        failed_readings_today=0,  # Mock data
        success_rate_today=100.0,  # Mock data
        last_execution=None,  # Mock data
        next_execution=None  # Mock data
    )

@router.get("/auto/configs", response_model=List[AutoCounterConfig])
def get_auto_counter_configs():
    """Obtiene todas las configuraciones de contadores automáticos"""
    return list(active_configs.values())

@router.post("/auto/configs", response_model=AutoCounterConfig)
def create_auto_counter_config(config: AutoCounterConfig, db: Session = Depends(get_db)):
    """Crea una nueva configuración de contador automático"""
    
    # Validar que las impresoras existen
    printers = db.query(Printer).filter(Printer.id.in_(config.printer_ids)).all()
    if len(printers) != len(config.printer_ids):
        raise HTTPException(status_code=400, detail="Una o más impresoras no existen")
    
    # Asignar ID único
    config.id = len(active_configs) + 1
    config.created_at = datetime.now()
    
    # Guardar en memoria (en producción esto iría a base de datos)
    active_configs[config.id] = config
    
    # Programar la lectura automática
    schedule_auto_reading(config)
    
    return config

@router.put("/auto/configs/{config_id}", response_model=AutoCounterConfig)
def update_auto_counter_config(
    config_id: int, 
    config_update: AutoCounterConfig, 
    db: Session = Depends(get_db)
):
    """Actualiza una configuración de contador automático"""
    
    if config_id not in active_configs:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    
    # Validar que las impresoras existen
    printers = db.query(Printer).filter(Printer.id.in_(config_update.printer_ids)).all()
    if len(printers) != len(config_update.printer_ids):
        raise HTTPException(status_code=400, detail="Una o más impresoras no existen")
    
    # Mantener ID y fechas originales
    original_config = active_configs[config_id]
    config_update.id = config_id
    config_update.created_at = original_config.created_at
    config_update.updated_at = datetime.now()
    
    # Actualizar configuración
    active_configs[config_id] = config_update
    
    # Re-programar la lectura automática
    schedule_auto_reading(config_update)
    
    return config_update

@router.delete("/auto/configs/{config_id}")
def delete_auto_counter_config(config_id: int):
    """Elimina una configuración de contador automático"""
    
    if config_id not in active_configs:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    
    # Remover job del scheduler
    job_id = f"auto_counter_{config_id}"
    try:
        auto_scheduler.remove_job(job_id)
    except:
        pass
    
    # Eliminar configuración
    del active_configs[config_id]
    
    return {"message": "Configuración eliminada exitosamente"}

@router.post("/auto/configs/{config_id}/toggle")
def toggle_auto_counter_config(config_id: int):
    """Habilita/deshabilita una configuración de contador automático"""
    
    if config_id not in active_configs:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    
    config = active_configs[config_id]
    config.enabled = not config.enabled
    config.updated_at = datetime.now()
    
    # Re-programar o remover según el estado
    schedule_auto_reading(config)
    
    return {"message": f"Configuración {'habilitada' if config.enabled else 'deshabilitada'}"}

@router.post("/auto/configs/{config_id}/execute")
def execute_auto_counter_manual(config_id: int, db: Session = Depends(get_db)):
    """Ejecuta manualmente una lectura automática"""
    
    if config_id not in active_configs:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    
    try:
        execute_auto_reading(config_id, db)
        return {"message": "Lectura ejecutada exitosamente"}
    except Exception as e:
        logger.error(f"Error executing manual reading: {e}")
        raise HTTPException(status_code=500, detail=f"Error al ejecutar lectura: {str(e)}")

@router.get("/auto/test/{printer_id}")
def test_printer_snmp(printer_id: int, db: Session = Depends(get_db)):
    """Prueba la conexión SNMP con una impresora específica"""
    
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    result = get_printer_counters_via_snmp(printer.ip)
    
    return {
        "printer_id": printer_id,
        "printer_name": f"{printer.brand} {printer.model}",
        "ip": printer.ip,
        "success": result['success'],
        "counters": result['counters'],
        "response_time": result['response_time'],
        "error": result['error']
    }