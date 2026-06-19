from calendar import monthrange
from typing import Dict, List

from sqlalchemy.orm import Session

from ..models import LocationCounterSegment, MonthlyCounter


DEFAULT_LOCATION = "Descubierto automaticamente"


def _normalize_location(value: str | None) -> str:
    if not value:
        return DEFAULT_LOCATION

    cleaned = value.strip()
    if not cleaned:
        return DEFAULT_LOCATION

    lowered = cleaned.lower()
    if lowered in {"descubierto automaticamente", "descubierto automáticamente"}:
        return DEFAULT_LOCATION

    return cleaned


def sync_location_segments_for_printer_month(
    db: Session,
    printer_id: int,
    year: int,
    month: int,
) -> None:
    """Synchronize auto-generated location segments (movement_id NULL) for a printer-month."""

    month_end = monthrange(year, month)[1]

    counters = (
        db.query(MonthlyCounter)
        .filter(
            MonthlyCounter.printer_id == printer_id,
            MonthlyCounter.year == year,
            MonthlyCounter.month == month,
        )
        .order_by(MonthlyCounter.recorded_at.asc(), MonthlyCounter.id.asc())
        .all()
    )

    auto_segments = (
        db.query(LocationCounterSegment)
        .filter(
            LocationCounterSegment.printer_id == printer_id,
            LocationCounterSegment.year == year,
            LocationCounterSegment.month == month,
            LocationCounterSegment.movement_id.is_(None),
        )
        .all()
    )

    if not counters:
        for segment in auto_segments:
            db.delete(segment)
        return

    grouped: Dict[str, List[MonthlyCounter]] = {}
    for row in counters:
        location = _normalize_location(row.location_snapshot)
        grouped.setdefault(location, []).append(row)

    existing_by_location = {
        seg.location: seg
        for seg in auto_segments
        if seg.segment_start_date == 1 and seg.segment_end_date == month_end
    }

    for location, rows in grouped.items():
        first = rows[0]
        last = rows[-1]
        pages_bw = sum(item.pages_printed_bw or 0 for item in rows)
        pages_color = sum(item.pages_printed_color or 0 for item in rows)
        pages_total = sum(item.pages_printed_total or 0 for item in rows)

        segment = existing_by_location.get(location)
        if not segment:
            segment = LocationCounterSegment(
                printer_id=printer_id,
                location=location,
                year=year,
                month=month,
                segment_start_date=1,
                segment_end_date=month_end,
                movement_id=None,
            )
            db.add(segment)

        segment.counter_bw_start = first.previous_counter_bw or 0
        segment.counter_bw_end = last.counter_bw or 0
        segment.counter_color_start = first.previous_counter_color or 0
        segment.counter_color_end = last.counter_color or 0
        segment.counter_total_start = first.previous_counter_total or 0
        segment.counter_total_end = last.counter_total or 0
        segment.pages_bw = pages_bw
        segment.pages_color = pages_color
        segment.pages_total = pages_total
        segment.data_quality = "real"

    valid_locations = set(grouped.keys())
    for segment in auto_segments:
        is_auto_full_month = (
            segment.movement_id is None
            and segment.segment_start_date == 1
            and segment.segment_end_date == month_end
        )
        if is_auto_full_month and segment.location not in valid_locations:
            db.delete(segment)
