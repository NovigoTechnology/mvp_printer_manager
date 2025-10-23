from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime, timedelta

from ..db import get_db
from ..models import UsageReport, Printer

router = APIRouter()

@router.get("/usage")
def get_usage_report(
    printer_id: Optional[int] = Query(None, description="Filter by printer ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """Get usage reports with optional filtering"""
    query = db.query(UsageReport)
    
    if printer_id:
        query = query.filter(UsageReport.printer_id == printer_id)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(UsageReport.date >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(UsageReport.date <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    reports = query.order_by(UsageReport.date.desc()).all()
    
    # Add printer info to each report
    result = []
    for report in reports:
        printer = db.query(Printer).filter(Printer.id == report.printer_id).first()
        result.append({
            "id": report.id,
            "printer_id": report.printer_id,
            "printer": {
                "brand": printer.brand if printer else None,
                "model": printer.model if printer else None,
                "location": printer.location if printer else None
            } if printer else None,
            "date": report.date,
            "pages_printed_mono": report.pages_printed_mono,
            "pages_printed_color": report.pages_printed_color,
            "toner_levels": {
                "black": report.toner_level_black,
                "cyan": report.toner_level_cyan,
                "magenta": report.toner_level_magenta,
                "yellow": report.toner_level_yellow
            },
            "paper_level": report.paper_level,
            "status": report.status,
            "created_at": report.created_at
        })
    
    return result

@router.get("/usage/monthly")
def get_monthly_usage(
    year: Optional[int] = Query(None, description="Year (default: current year)"),
    printer_id: Optional[int] = Query(None, description="Filter by printer ID"),
    db: Session = Depends(get_db)
):
    """Get monthly usage statistics"""
    if not year:
        year = datetime.now().year
    
    query = db.query(
        extract('month', UsageReport.date).label('month'),
        func.sum(UsageReport.pages_printed_mono).label('total_mono'),
        func.sum(UsageReport.pages_printed_color).label('total_color'),
        func.count(UsageReport.id).label('report_count')
    ).filter(
        extract('year', UsageReport.date) == year
    )
    
    if printer_id:
        query = query.filter(UsageReport.printer_id == printer_id)
    
    monthly_data = query.group_by(
        extract('month', UsageReport.date)
    ).order_by(
        extract('month', UsageReport.date)
    ).all()
    
    # Create a complete 12-month dataset
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    result = []
    data_dict = {int(row.month): row for row in monthly_data}
    
    for i in range(1, 13):
        if i in data_dict:
            row = data_dict[i]
            result.append({
                "month": months[i-1],
                "month_number": i,
                "pages_mono": int(row.total_mono or 0),
                "pages_color": int(row.total_color or 0),
                "total_pages": int((row.total_mono or 0) + (row.total_color or 0)),
                "report_count": int(row.report_count)
            })
        else:
            result.append({
                "month": months[i-1],
                "month_number": i,
                "pages_mono": 0,
                "pages_color": 0,
                "total_pages": 0,
                "report_count": 0
            })
    
    return result

@router.get("/toner")
def get_toner_levels(db: Session = Depends(get_db)):
    """Get current toner levels for all printers"""
    # Get the latest report for each printer
    subquery = db.query(
        UsageReport.printer_id,
        func.max(UsageReport.created_at).label('latest')
    ).group_by(UsageReport.printer_id).subquery()
    
    latest_reports = db.query(UsageReport).join(
        subquery,
        (UsageReport.printer_id == subquery.c.printer_id) &
        (UsageReport.created_at == subquery.c.latest)
    ).all()
    
    result = []
    for report in latest_reports:
        printer = db.query(Printer).filter(Printer.id == report.printer_id).first()
        if printer:
            result.append({
                "printer_id": printer.id,
                "printer": {
                    "brand": printer.brand,
                    "model": printer.model,
                    "location": printer.location
                },
                "toner_levels": {
                    "black": report.toner_level_black,
                    "cyan": report.toner_level_cyan,
                    "magenta": report.toner_level_magenta,
                    "yellow": report.toner_level_yellow
                },
                "paper_level": report.paper_level,
                "status": report.status,
                "last_update": report.created_at
            })
    
    return result

@router.get("/summary")
def get_summary_stats(db: Session = Depends(get_db)):
    """Get overall summary statistics"""
    # Total printers
    total_printers = db.query(Printer).count()
    
    # Active printers (those with reports in last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    active_printers = db.query(UsageReport.printer_id).filter(
        UsageReport.created_at >= yesterday
    ).distinct().count()
    
    # Total pages printed this month
    current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_stats = db.query(
        func.sum(UsageReport.pages_printed_mono).label('total_mono'),
        func.sum(UsageReport.pages_printed_color).label('total_color')
    ).filter(UsageReport.date >= current_month).first()
    
    # Low toner alerts (< 20%)
    low_toner_count = db.query(UsageReport.printer_id).filter(
        (UsageReport.toner_level_black < 20) |
        (UsageReport.toner_level_cyan < 20) |
        (UsageReport.toner_level_magenta < 20) |
        (UsageReport.toner_level_yellow < 20)
    ).distinct().count()
    
    return {
        "total_printers": total_printers,
        "active_printers": active_printers,
        "monthly_pages": {
            "mono": int(monthly_stats.total_mono or 0),
            "color": int(monthly_stats.total_color or 0),
            "total": int((monthly_stats.total_mono or 0) + (monthly_stats.total_color or 0))
        },
        "low_toner_alerts": low_toner_count
    }

@router.get("/printing-history")
def get_printing_history(db: Session = Depends(get_db)):
    """Get printing history by printer and month"""
    from ..models import MonthlyCounter
    
    # Get all monthly counters with printer information
    query = db.query(
        MonthlyCounter.printer_id,
        MonthlyCounter.year,
        MonthlyCounter.month,
        MonthlyCounter.pages_printed_total,
        MonthlyCounter.pages_printed_bw,
        MonthlyCounter.pages_printed_color,
        Printer.brand,
        Printer.model,
        Printer.hostname,
        Printer.location,
        Printer.status
    ).join(
        Printer, MonthlyCounter.printer_id == Printer.id
    ).order_by(
        Printer.brand,
        Printer.model,
        MonthlyCounter.year.desc(),
        MonthlyCounter.month.desc()
    )
    
    results = query.all()
    
    # Group by printer
    printers_history = {}
    
    for row in results:
        printer_key = f"{row.printer_id}"
        
        if printer_key not in printers_history:
            printers_history[printer_key] = {
                "printer_id": row.printer_id,
                "brand": row.brand,
                "model": row.model,
                "hostname": row.hostname,
                "location": row.location,
                "status": row.status,
                "monthly_history": []
            }
        
        # Add monthly data
        month_names = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ]
        
        printers_history[printer_key]["monthly_history"].append({
            "year": row.year,
            "month": row.month,
            "month_name": month_names[row.month - 1],
            "period": f"{month_names[row.month - 1]} {row.year}",
            "total_pages": row.pages_printed_total or 0,
            "bw_pages": row.pages_printed_bw or 0,
            "color_pages": row.pages_printed_color or 0
        })
    
    # Convert to list and sort
    result = list(printers_history.values())
    result.sort(key=lambda x: (x["brand"], x["model"]))
    
    return result

@router.get("/printing-history/{printer_id}")
def get_printer_history(printer_id: int, db: Session = Depends(get_db)):
    """Get printing history for a specific printer"""
    from ..models import MonthlyCounter
    
    # Check if printer exists
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Get monthly counters for this printer
    query = db.query(MonthlyCounter).filter(
        MonthlyCounter.printer_id == printer_id
    ).order_by(
        MonthlyCounter.year.desc(),
        MonthlyCounter.month.desc()
    )
    
    monthly_counters = query.all()
    
    # Format the data
    month_names = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    
    history = []
    for counter in monthly_counters:
        history.append({
            "year": counter.year,
            "month": counter.month,
            "month_name": month_names[counter.month - 1],
            "period": f"{month_names[counter.month - 1]} {counter.year}",
            "total_pages": counter.pages_printed_total or 0,
            "bw_pages": counter.pages_printed_bw or 0,
            "color_pages": counter.pages_printed_color or 0,
            "recorded_at": counter.recorded_at
        })
    
    return {
        "printer": {
            "id": printer.id,
            "brand": printer.brand,
            "model": printer.model,
            "hostname": printer.hostname,
            "location": printer.location,
            "status": printer.status
        },
        "history": history
    }