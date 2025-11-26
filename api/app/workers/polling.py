from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import asyncio
from sqlalchemy.orm import Session
import json

from ..db import SessionLocal
from ..models import Printer, UsageReport, CounterSchedule, MedicalPrinterCounter
from ..services.snmp import SNMPService
from ..services.medical_printer_service import DrypixScraper
from ..services.exchange_rate_service import update_exchange_rates_task
from .hourly_medical_polling import poll_medical_printers_hourly, cleanup_old_snapshots_job

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

def poll_medical_printers():
    """Poll all medical printers (DRYPIX) and save counter snapshots"""
    db = SessionLocal()
    try:
        # Get all active DRYPIX printers
        medical_printers = db.query(Printer).filter(
            Printer.status == "active",
            Printer.model.ilike("%DRYPIX%")
        ).all()
        
        if not medical_printers:
            print("No active medical printers found")
            return
        
        print(f"Polling {len(medical_printers)} medical printers...")
        success_count = 0
        error_count = 0
        
        for printer in medical_printers:
            try:
                # Check if we already have a record for today
                today = datetime.utcnow().date()
                existing_record = db.query(MedicalPrinterCounter).filter(
                    MedicalPrinterCounter.printer_id == printer.id,
                    MedicalPrinterCounter.timestamp >= datetime.combine(today, datetime.min.time()),
                    MedicalPrinterCounter.timestamp < datetime.combine(today + timedelta(days=1), datetime.min.time())
                ).first()
                
                if existing_record:
                    print(f"Counter snapshot for medical printer {printer.id} ({printer.ip}) already exists for today")
                    continue
                
                # Poll the medical printer
                print(f"Polling medical printer {printer.id} ({printer.ip})")
                scraper = DrypixScraper(printer.ip, 20051)
                result = scraper.get_counters()
                
                if result:
                    # Detectar cambios de cartucho comparando con registro anterior
                    cartridge_change_detected = False
                    tray_number_changed = None
                    films_added = 0
                    daily_printed = result['summary']['total_printed']  # Por defecto, el contador actual
                    
                    # Obtener último registro
                    last_record = db.query(MedicalPrinterCounter).filter(
                        MedicalPrinterCounter.printer_id == printer.id
                    ).order_by(MedicalPrinterCounter.timestamp.desc()).first()
                    
                    if last_record and last_record.raw_data:
                        try:
                            last_data = json.loads(last_record.raw_data)
                            current_data = result
                            
                            # Comparar cada bandeja
                            MIN_INCREMENT_THRESHOLD = 20  # Umbral mínimo para detectar cambio
                            
                            for tray_key in current_data.get('trays', {}).keys():
                                current_available = current_data['trays'][tray_key]['available']
                                current_printed = current_data['trays'][tray_key]['printed']
                                last_available = last_data.get('trays', {}).get(tray_key, {}).get('available', 0)
                                last_printed = last_data.get('trays', {}).get(tray_key, {}).get('printed', 0)
                                
                                increment = current_available - last_available
                                
                                if increment >= MIN_INCREMENT_THRESHOLD:
                                    # Cambio de cartucho detectado
                                    cartridge_change_detected = True
                                    tray_number_changed = current_data['trays'][tray_key]['tray_number']
                                    films_added = 100  # Siempre son 100 films por cartucho nuevo
                                    
                                    # CORRECCIÓN: Calcular cuánto se imprimió del cartucho ANTERIOR
                                    # Lo que se imprimió = lo que había disponible antes (se consumió todo)
                                    # Más lo que ya estaba impreso
                                    films_printed_from_old_cartridge = last_available
                                    
                                    # El total impreso para este snapshot debe reflejar lo del cartucho anterior
                                    daily_printed = films_printed_from_old_cartridge
                                    
                                    print(f"🔄 CAMBIO DE CARTUCHO DETECTADO - Printer {printer.id} {tray_key}: "
                                          f"Disponibles: {last_available} → {current_available}")
                                    print(f"   Films impresos del cartucho anterior: {films_printed_from_old_cartridge}")
                                    print(f"   Cartucho nuevo cargado: 100 films")
                                    break  # Solo registrar el primer cambio detectado
                        except Exception as e:
                            print(f"Error al detectar cambios de cartucho: {str(e)}")
                    
                    # Save counter snapshot
                    counter_record = MedicalPrinterCounter(
                        printer_id=printer.id,
                        timestamp=datetime.utcnow(),
                        total_printed=daily_printed,  # Corregido para reflejar lo impreso del cartucho anterior si hubo cambio
                        total_available=result['summary']['total_available'],
                        total_trays_loaded=result['summary']['total_trays_loaded'],
                        is_online=result['is_online'],
                        cartridge_change_detected=cartridge_change_detected,
                        tray_number_changed=tray_number_changed,
                        films_added=films_added,
                        raw_data=json.dumps(result),
                        collection_method='automatic',
                        notes=f"Se cambió cartucho (100 films). Impresos del cartucho anterior: {daily_printed}" 
                              if cartridge_change_detected else None
                    )
                    
                    db.add(counter_record)
                    db.commit()
                    success_count += 1
                    print(f"Successfully saved counter snapshot for medical printer {printer.id}")
                else:
                    error_count += 1
                    print(f"Failed to get counters from medical printer {printer.id}")
                
            except Exception as e:
                error_count += 1
                print(f"Error polling medical printer {printer.id} ({printer.ip}): {str(e)}")
                db.rollback()
                continue
        
        print(f"Medical printer polling completed: {success_count} successful, {error_count} errors")
                
    except Exception as e:
        print(f"Error in poll_medical_printers: {str(e)}")
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
    
    # Update exchange rates daily at 9 AM
    scheduler.add_job(
        update_exchange_rates_task,
        'cron',
        hour=9,
        minute=0,
        id='update_exchange_rates',
        name='Update exchange rates from APIs',
        replace_existing=True
    )
    
    # Check for scheduled counter jobs every 5 minutes
    scheduler.add_job(
        check_scheduled_counters,
        'interval',
        minutes=5,
        id='check_scheduled_counters',
        name='Check and execute scheduled counter jobs',
        replace_existing=True
    )
    
    # Poll medical printers daily at 7 AM (snapshots diarios históricos)
    scheduler.add_job(
        poll_medical_printers,
        'cron',
        hour=7,
        minute=0,
        id='poll_medical_printers',
        name='Poll medical printers (DRYPIX) for daily counters',
        replace_existing=True
    )
    
    # Poll medical printers every hour (snapshots horarios + detección automática)
    scheduler.add_job(
        poll_medical_printers_hourly,
        'cron',
        minute=0,  # A la hora en punto
        id='poll_medical_printers_hourly',
        name='Hourly medical printer snapshots with auto cartridge detection',
        replace_existing=True
    )
    
    # Cleanup old snapshots daily at 3 AM
    scheduler.add_job(
        cleanup_old_snapshots_job,
        'cron',
        hour=3,
        minute=0,
        id='cleanup_old_snapshots',
        name='Cleanup old hourly snapshots (keep 30 days)',
        replace_existing=True
    )
    
    print("Scheduled tasks configured:")
    print("- Poll printers: every 30 minutes")
    print("- Cleanup old reports: daily at 2:00 AM")
    print("- Check scheduled counters: every 5 minutes")
    print("- Update exchange rates: daily at 9:00 AM")
    print("- Poll medical printers (daily): daily at 7:00 AM")
    print("- Poll medical printers (hourly): every hour for cartridge detection")
    print("- Cleanup old snapshots: daily at 3:00 AM")

def check_scheduled_counters():
    """Check for scheduled counter jobs that need to be executed"""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        
        # Get active schedules that are due to run
        due_schedules = db.query(CounterSchedule).filter(
            CounterSchedule.is_active == True,
            CounterSchedule.next_run <= now
        ).all()
        
        for schedule in due_schedules:
            try:
                print(f"Executing scheduled counter job: {schedule.name} (ID: {schedule.id})")
                execute_scheduled_counter_job(schedule.id, db)
            except Exception as e:
                print(f"Error executing scheduled counter job {schedule.id}: {str(e)}")
                # Update error count
                schedule.error_count += 1
                schedule.last_error = str(e)
                db.commit()
                
    except Exception as e:
        print(f"Error in check_scheduled_counters: {str(e)}")
    finally:
        db.close()

def execute_scheduled_counter_job(schedule_id: int, db: Session):
    """Execute a specific scheduled counter job"""
    try:
        schedule = db.query(CounterSchedule).filter(CounterSchedule.id == schedule_id).first()
        if not schedule:
            print(f"Schedule {schedule_id} not found")
            return
        
        # Get target printers
        if schedule.target_type == "all":
            printers = db.query(Printer).filter(Printer.status == "active").all()
        elif schedule.target_type == "selection":
            printer_ids = json.loads(schedule.printer_ids) if schedule.printer_ids else []
            printers = db.query(Printer).filter(
                Printer.id.in_(printer_ids),
                Printer.status == "active"
            ).all()
        else:  # single
            printer_ids = json.loads(schedule.printer_ids) if schedule.printer_ids else []
            if printer_ids:
                printers = db.query(Printer).filter(
                    Printer.id == printer_ids[0],
                    Printer.status == "active"
                ).all()
            else:
                printers = []
        
        if not printers:
            print(f"No active printers found for schedule {schedule_id}")
            return
        
        # Initialize SNMP service
        snmp_service = SNMPService()
        polled_count = 0
        error_count = 0
        errors = []
        
        # Poll each printer
        for printer in printers:
            try:
                # Check if we already have a report for today
                today = datetime.utcnow().date()
                existing_report = db.query(UsageReport).filter(
                    UsageReport.printer_id == printer.id,
                    UsageReport.date >= datetime.combine(today, datetime.min.time()),
                    UsageReport.date < datetime.combine(today + timedelta(days=1), datetime.min.time())
                ).first()
                
                if existing_report:
                    print(f"Report for printer {printer.id} ({printer.ip}) already exists for today")
                    continue
                
                # Poll the printer
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
                polled_count += 1
                print(f"Successfully polled printer {printer.id} ({printer.ip})")
                
            except Exception as e:
                error_msg = f"Error polling printer {printer.id} ({printer.ip}): {str(e)}"
                errors.append(error_msg)
                error_count += 1
                print(error_msg)
                continue
        
        # Update schedule statistics
        schedule.last_run = datetime.utcnow()
        schedule.next_run = calculate_next_run_time(schedule)
        schedule.run_count += 1
        
        if errors:
            schedule.error_count += 1
            schedule.last_error = "; ".join(errors[:3])  # Store first 3 errors
        else:
            schedule.last_error = None
        
        db.commit()
        
        print(f"Scheduled job {schedule_id} completed: {polled_count} printers polled, {error_count} errors")
        
    except Exception as e:
        print(f"Error in execute_scheduled_counter_job: {str(e)}")
        raise

def calculate_next_run_time(schedule: CounterSchedule) -> datetime:
    """Calculate the next run time for a schedule"""
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
            return now + timedelta(hours=24)
    
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
            return now + timedelta(days=7)
    
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
            return now + timedelta(days=30)
    
    # Default fallback: next day
    return now + timedelta(hours=24)