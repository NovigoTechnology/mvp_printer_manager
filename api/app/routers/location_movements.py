"""
Location Movements and Location Counter Segments API Routes
Handles printer location movements and location-based counter tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import logging

from ..db import get_db
from ..models import PrinterMovement, LocationCounterSegment, Printer, MonthlyCounter
from ..services.snmp import SNMPService

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class PrinterMovementCreate(BaseModel):
    printer_id: int
    location_to: str = "Descubierto automaticamente"
    movement_reason: Optional[str] = None
    movement_date: Optional[datetime] = None


class PrinterMovementResponse(BaseModel):
    id: int
    printer_id: int
    location_from: Optional[str]
    location_to: str
    movement_date: datetime
    movement_reason: Optional[str]
    snapshot_status: str
    snapshot_counter_total: Optional[int]
    snapshot_success: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LocationCounterSegmentResponse(BaseModel):
    id: int
    printer_id: int
    location: str
    year: int
    month: int
    segment_start_date: int
    segment_end_date: int
    counter_total_start: Optional[int]
    counter_total_end: Optional[int]
    pages_total: int
    pages_bw: int
    pages_color: int
    data_quality: str
    created_at: datetime

    class Config:
        from_attributes = True


class LocationCounterSummary(BaseModel):
    location: str
    total_pages: int
    total_pages_bw: int
    total_pages_color: int
    printers_count: int
    data_quality_distribution: Dict[str, int]


# ==================== Endpoints ====================

@router.post("/movements", response_model=PrinterMovementResponse)
def register_printer_movement(
    movement: PrinterMovementCreate,
    db: Session = Depends(get_db)
):
    """
    Register a printer movement with automatic snapshot attempt.
    If location_to is not provided, uses "Descubierto automaticamente".
    """

    # Validate printer exists
    printer = db.query(Printer).filter(Printer.id == movement.printer_id).first()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Printer {movement.printer_id} not found"
        )

    # Get movement date (default to now)
    movement_date = movement.movement_date or datetime.utcnow()

    # Get current location
    location_from = printer.location or "Descubierto automaticamente"

    # Create movement record
    db_movement = PrinterMovement(
        printer_id=movement.printer_id,
        location_from=location_from,
        location_to=movement.location_to or "Descubierto automaticamente",
        movement_date=movement_date,
        movement_reason=movement.movement_reason,
        snapshot_status="pending",
        snapshot_success=False
    )

    # Try to get snapshot via SNMP
    try:
        snmp_service = SNMPService()

        # Get last known counter before movement for fallback
        last_counter = db.query(MonthlyCounter)\
            .filter(MonthlyCounter.printer_id == movement.printer_id)\
            .order_by(MonthlyCounter.id.desc())\
            .first()

        # Attempt SNMP snapshot
        try:
            counters = snmp_service.get_counters(printer.ip)
            if counters:
                db_movement.snapshot_counter_bw = counters.get("bw", 0)
                db_movement.snapshot_counter_color = counters.get("color", 0)
                db_movement.snapshot_counter_total = counters.get("total", 0)
                db_movement.snapshot_status = "real"
                db_movement.snapshot_success = True
                db_movement.snapshot_attempt_at = datetime.utcnow()
            elif last_counter:
                # Use fallback: last valid counter
                db_movement.snapshot_counter_bw = last_counter.counter_bw
                db_movement.snapshot_counter_color = last_counter.counter_color
                db_movement.snapshot_counter_total = last_counter.counter_total
                db_movement.snapshot_status = "estimated"
                db_movement.snapshot_success = False
                db_movement.fallback_source = "last_valid"
                db_movement.snapshot_attempt_at = datetime.utcnow()
        except Exception as snmp_error:
            logger.warning(f"SNMP failed for printer {movement.printer_id}: {snmp_error}")
            if last_counter:
                db_movement.snapshot_counter_bw = last_counter.counter_bw
                db_movement.snapshot_counter_color = last_counter.counter_color
                db_movement.snapshot_counter_total = last_counter.counter_total
                db_movement.snapshot_status = "estimated"
                db_movement.snapshot_success = False
                db_movement.fallback_source = "last_valid"
                db_movement.snapshot_attempt_at = datetime.utcnow()

    except Exception as e:
        logger.error(f"Error processing movement snapshot: {e}")
        db_movement.snapshot_status = "pending"

    # Update printer current location
    printer.location = movement.location_to or "Descubierto automaticamente"

    # Save movement
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)

    return db_movement


@router.get("/movements/{printer_id}", response_model=List[PrinterMovementResponse])
def get_printer_movements(
    printer_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get all movements for a printer, optionally filtered by year/month.
    """

    # Validate printer exists
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Printer {printer_id} not found"
        )

    query = db.query(PrinterMovement).filter(PrinterMovement.printer_id == printer_id)

    if year and month:
        from datetime import datetime
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        query = query.filter(
            and_(
                PrinterMovement.movement_date >= start_date,
                PrinterMovement.movement_date < end_date
            )
        )

    movements = query.order_by(PrinterMovement.movement_date.desc()).all()
    return movements


@router.get("/segments", response_model=List[LocationCounterSegmentResponse])
def get_location_counter_segments(
    year: int,
    month: int,
    location: Optional[str] = None,
    printer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Query location counter segments for a given year/month.
    Can filter by location and/or printer_id.
    """

    query = db.query(LocationCounterSegment)\
        .filter(
            and_(
                LocationCounterSegment.year == year,
                LocationCounterSegment.month == month
            )
        )

    if location:
        query = query.filter(LocationCounterSegment.location == location)

    if printer_id:
        query = query.filter(LocationCounterSegment.printer_id == printer_id)

    segments = query.order_by(
        LocationCounterSegment.location,
        LocationCounterSegment.segment_start_date
    ).all()

    return segments


@router.get("/location-summary", response_model=List[LocationCounterSummary])
def get_location_counter_summary(
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    Get summary of counter data by location for a given month.
    Shows total pages, page breakdown, and data quality stats.
    """

    segments = db.query(LocationCounterSegment)\
        .filter(
            and_(
                LocationCounterSegment.year == year,
                LocationCounterSegment.month == month
            )
        ).all()

    # Aggregate by location
    summary_by_location: Dict[str, Dict[str, Any]] = {}

    for segment in segments:
        loc = segment.location or "Descubierto automaticamente"
        if loc not in summary_by_location:
            summary_by_location[loc] = {
                "total_pages": 0,
                "total_pages_bw": 0,
                "total_pages_color": 0,
                "printers": set(),
                "data_quality": {}
            }

        summary_by_location[loc]["total_pages"] += segment.pages_total or 0
        summary_by_location[loc]["total_pages_bw"] += segment.pages_bw or 0
        summary_by_location[loc]["total_pages_color"] += segment.pages_color or 0
        summary_by_location[loc]["printers"].add(segment.printer_id)

        dq = segment.data_quality or "partial"
        summary_by_location[loc]["data_quality"][dq] = \
            summary_by_location[loc]["data_quality"].get(dq, 0) + 1

    # Format response
    result = []
    for location, data in summary_by_location.items():
        result.append(LocationCounterSummary(
            location=location,
            total_pages=data["total_pages"],
            total_pages_bw=data["total_pages_bw"],
            total_pages_color=data["total_pages_color"],
            printers_count=len(data["printers"]),
            data_quality_distribution=data["data_quality"]
        ))

    return sorted(result, key=lambda x: x.location)


@router.post("/segments/sync-from-counters")
def sync_segments_from_monthly_counters(
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    Sync location counter segments from monthly_counters table.
    For each monthly_counter record, create or update segments.
    This is typically called after counter collection.
    """

    try:
        # Get all monthly counters for this period
        counters = db.query(MonthlyCounter)\
            .filter(
                and_(
                    MonthlyCounter.year == year,
                    MonthlyCounter.month == month
                )
            ).all()

        created_count = 0

        for counter in counters:
            # Try to find existing segment for this printer/location/month
            segment = db.query(LocationCounterSegment)\
                .filter(
                    and_(
                        LocationCounterSegment.printer_id == counter.printer_id,
                        LocationCounterSegment.location == (counter.location_snapshot or "Descubierto automaticamente"),
                        LocationCounterSegment.year == year,
                        LocationCounterSegment.month == month
                    )
                ).first()

            if not segment:
                # Create new segment (full month by default)
                segment = LocationCounterSegment(
                    printer_id=counter.printer_id,
                    location=counter.location_snapshot or "Descubierto automaticamente",
                    year=year,
                    month=month,
                    segment_start_date=1,
                    segment_end_date=31,  # Full month
                    counter_total_start=counter.counter_total,
                    counter_total_end=counter.counter_total,
                    pages_total=0,
                    data_quality="real"
                )
                db.add(segment)
                created_count += 1

        db.commit()

        return {
            "status": "success",
            "created_segments": created_count,
            "total_counters": len(counters)
        }

    except Exception as e:
        logger.error(f"Error syncing segments: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing segments: {str(e)}"
        )


@router.get("/segments/validate/{year}/{month}")
def validate_location_segments(
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    Validate that sum of location segments equals general counter totals.
    Returns validation results and any discrepancies.
    """

    try:
        # Get all monthly counters for this period
        general_counters = db.query(MonthlyCounter)\
            .filter(
                and_(
                    MonthlyCounter.year == year,
                    MonthlyCounter.month == month
                )
            ).all()

        # Get all location segments for this period
        segments = db.query(LocationCounterSegment)\
            .filter(
                and_(
                    LocationCounterSegment.year == year,
                    LocationCounterSegment.month == month
                )
            ).all()

        # Group segments by printer
        segments_by_printer: Dict[int, int] = {}
        for segment in segments:
            if segment.printer_id not in segments_by_printer:
                segments_by_printer[segment.printer_id] = 0
            segments_by_printer[segment.printer_id] += segment.pages_total or 0

        # Compare with general counters
        discrepancies = []
        for counter in general_counters:
            segment_pages = segments_by_printer.get(counter.printer_id, 0)
            general_pages = counter.counter_total or 0

            # Allow 1% tolerance due to rounding
            tolerance = max(1, int(general_pages * 0.01))

            if abs(segment_pages - general_pages) > tolerance:
                discrepancies.append({
                    "printer_id": counter.printer_id,
                    "general_counter": general_pages,
                    "sum_location_segments": segment_pages,
                    "difference": general_pages - segment_pages
                })

        return {
            "status": "valid" if not discrepancies else "invalid",
            "year": year,
            "month": month,
            "general_counters_count": len(general_counters),
            "location_segments_count": len(segments),
            "discrepancies": discrepancies
        }

    except Exception as e:
        logger.error(f"Error validating segments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating segments: {str(e)}"
        )
