from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import asyncio
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Printer, UsageReport
from ..services.snmp import SNMPService

def poll_all_printers():
    """Poll all printers and save usage reports"""
    db = SessionLocal()
    try:
        printers = db.query(Printer).all()
        snmp_service = SNMPService()
        
        for printer in printers:
            try:
                # Check if we already have a report for today
                today = datetime.now().date()
                existing_report = db.query(UsageReport).filter(
                    UsageReport.printer_id == printer.id,
                    UsageReport.date >= datetime.combine(today, datetime.min.time()),
                    UsageReport.date < datetime.combine(today + timedelta(days=1), datetime.min.time())
                ).first()
                
                if existing_report:
                    print(f"Report for printer {printer.id} ({printer.ip}) already exists for today")
                    continue
                
                # Poll the printer
                print(f"Polling printer {printer.id} ({printer.ip}) with profile {printer.snmp_profile}")
                data = snmp_service.poll_printer(printer.ip, printer.snmp_profile)
                
                # Create usage report
                usage_report = UsageReport(
                    printer_id=printer.id,
                    date=datetime.utcnow(),
                    pages_printed_mono=data.get('pages_printed_mono', 0),
                    pages_printed_color=data.get('pages_printed_color', 0),
                    toner_level_black=data.get('toner_level_black'),
                    toner_level_cyan=data.get('toner_level_cyan'),
                    toner_level_magenta=data.get('toner_level_magenta'),
                    toner_level_yellow=data.get('toner_level_yellow'),
                    paper_level=data.get('paper_level'),
                    status=data.get('status', 'unknown')
                )
                
                db.add(usage_report)
                db.commit()
                print(f"Successfully polled and saved data for printer {printer.id}")
                
            except Exception as e:
                print(f"Error polling printer {printer.id} ({printer.ip}): {str(e)}")
                db.rollback()
                continue
                
    except Exception as e:
        print(f"Error in poll_all_printers: {str(e)}")
    finally:
        db.close()

def cleanup_old_reports():
    """Clean up old usage reports (older than 1 year)"""
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=365)
        deleted_count = db.query(UsageReport).filter(
            UsageReport.created_at < cutoff_date
        ).delete()
        
        db.commit()
        print(f"Cleaned up {deleted_count} old usage reports")
        
    except Exception as e:
        print(f"Error in cleanup_old_reports: {str(e)}")
        db.rollback()
    finally:
        db.close()

def start_scheduler(scheduler: AsyncIOScheduler):
    """Configure and start the scheduled tasks"""
    
    # Poll printers every 30 minutes
    scheduler.add_job(
        poll_all_printers,
        'interval',
        minutes=30,
        id='poll_printers',
        name='Poll all printers for usage data',
        replace_existing=True
    )
    
    # Cleanup old reports daily at 2 AM
    scheduler.add_job(
        cleanup_old_reports,
        'cron',
        hour=2,
        minute=0,
        id='cleanup_reports',
        name='Cleanup old usage reports',
        replace_existing=True
    )
    
    print("Scheduled tasks configured:")
    print("- Poll printers: every 30 minutes")
    print("- Cleanup old reports: daily at 2:00 AM")