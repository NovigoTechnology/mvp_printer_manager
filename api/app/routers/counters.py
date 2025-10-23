from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import MonthlyCounter, Printer

router = APIRouter()

class MonthlyCounterCreate(BaseModel):
    printer_id: int
    year: int
    month: int
    counter_bw: int
    counter_color: int
    counter_total: int
    notes: Optional[str] = None

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
    notes: Optional[str] = None
    locked: bool = True
    recorded_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

def calculate_pages_printed(current: int, previous: int) -> int:
    """Calculate pages printed, ensuring non-negative result"""
    return max(0, current - previous)

def get_previous_month_counter(db: Session, printer_id: int, year: int, month: int) -> Optional[MonthlyCounter]:
    """Get the most recent previous counter for a printer (not necessarily the immediate previous month)"""
    return db.query(MonthlyCounter).filter(
        MonthlyCounter.printer_id == printer_id,
        # Find counters before the current period
        ((MonthlyCounter.year < year) | 
         ((MonthlyCounter.year == year) & (MonthlyCounter.month < month)))
    ).order_by(
        MonthlyCounter.year.desc(),
        MonthlyCounter.month.desc()
    ).first()

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
                location=printer.location
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
    
    # Get previous month's counter for calculations
    prev_counter = get_previous_month_counter(db, counter.printer_id, counter.year, counter.month)
    
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
        notes=counter.notes
    )
    
    db.add(db_counter)
    db.commit()
    db.refresh(db_counter)
    
    # Return response with printer info
    printer_summary = PrinterSummary(
        brand=printer.brand,
        model=printer.model,
        ip=printer.ip,
        location=printer.location
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
    
    # Recalculate previous counters (in case the logic was improved)
    prev_counter = get_previous_month_counter(db, db_counter.printer_id, db_counter.year, db_counter.month)
    
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
    
    db.commit()
    db.refresh(db_counter)
    
    # Return response with printer info
    printer_summary = PrinterSummary(
        brand=printer.brand,
        model=printer.model,
        ip=printer.ip,
        location=printer.location
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
    
    db.delete(db_counter)
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
        location=printer.location
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
        notes=db_counter.notes,
        locked=db_counter.locked,
        recorded_at=db_counter.recorded_at,
        created_at=db_counter.created_at,
        updated_at=db_counter.updated_at
    )