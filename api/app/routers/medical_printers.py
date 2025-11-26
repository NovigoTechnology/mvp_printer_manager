from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from ..db import get_db
from ..models import Printer, MedicalPrinterCounter
from ..services.medical_printer_service import DrypixScraper
import json

router = APIRouter()
logger = logging.getLogger(__name__)

class TrayInfo(BaseModel):
    available: int
    printed: int

class MedicalCounterSummary(BaseModel):
    total_available: int
    total_printed: int
    total_trays_loaded: int

class MedicalCounterData(BaseModel):
    timestamp: str
    tray_capacity: int
    trays: Dict[str, TrayInfo]
    summary: MedicalCounterSummary
    status: str
    is_online: bool

class MedicalPrinterStatus(BaseModel):
    printer_id: int
    printer_name: str
    ip: str
    success: bool
    counters: Optional[MedicalCounterData] = None
    error_message: Optional[str] = None
    response_time: Optional[float] = None

@router.get("/{printer_id}/counters", response_model=MedicalPrinterStatus)
async def get_medical_printer_counters(printer_id: int, db: Session = Depends(get_db)):
    """
    Obtiene los contadores en tiempo real de una impresora médica DRYPIX
    """
    try:
        # Buscar impresora
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        # Verificar que sea una impresora médica
        if 'DRYPIX' not in printer.model.upper():
            raise HTTPException(
                status_code=400, 
                detail="This endpoint is only for DRYPIX medical printers"
            )
        
        logger.info(f"Fetching counters for DRYPIX printer {printer_id} at {printer.ip}")
        
        start_time = datetime.now()
        
        # Conectar a la impresora DRYPIX
        scraper = DrypixScraper(printer.ip, 20051)
        
        # Obtener contadores
        result = scraper.get_counters()
        
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds()
        
        if result:
            # Convertir resultado a formato Pydantic
            trays_dict = {}
            for tray_name, tray_data in result['trays'].items():
                trays_dict[tray_name] = TrayInfo(
                    available=tray_data['available'],
                    printed=tray_data['printed']
                )
            
            counters = MedicalCounterData(
                timestamp=result['timestamp'],
                tray_capacity=result['tray_capacity'],
                trays=trays_dict,
                summary=MedicalCounterSummary(
                    total_available=result['summary']['total_available'],
                    total_printed=result['summary']['total_printed'],
                    total_trays_loaded=result['summary']['total_trays_loaded']
                ),
                status=result['status'],
                is_online=result['is_online']
            )
            
            # Guardar snapshot en la base de datos para historial
            try:
                counter_record = MedicalPrinterCounter(
                    printer_id=printer.id,
                    timestamp=datetime.now(),
                    total_printed=result['summary']['total_printed'],
                    total_available=result['summary']['total_available'],
                    total_trays_loaded=result['summary']['total_trays_loaded'],
                    is_online=result['is_online'],
                    raw_data=json.dumps(result),
                    collection_method='api'
                )
                db.add(counter_record)
                db.commit()
                logger.info(f"Saved counter snapshot for printer {printer_id}")
            except Exception as save_error:
                logger.error(f"Error saving counter snapshot: {save_error}")
                # No falla la petición si falla el guardado del historial
                db.rollback()
            
            return MedicalPrinterStatus(
                printer_id=printer.id,
                printer_name=f"{printer.brand} {printer.model}",
                ip=printer.ip,
                success=True,
                counters=counters,
                response_time=response_time
            )
        else:
            logger.warning(f"Failed to get counters from DRYPIX {printer_id}")
            return MedicalPrinterStatus(
                printer_id=printer.id,
                printer_name=f"{printer.brand} {printer.model}",
                ip=printer.ip,
                success=False,
                error_message="No se pudieron obtener contadores - verifique que la impresora esté encendida y accesible",
                response_time=response_time
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching medical printer counters: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener contadores: {str(e)}"
        )

@router.get("/list")
async def list_medical_printers(db: Session = Depends(get_db)):
    """
    Lista todas las impresoras médicas registradas en el sistema
    """
    try:
        # Buscar todas las impresoras activas que sean médicas
        printers = db.query(Printer).filter(
            Printer.status == "active"
        ).all()
        
        # Filtrar solo impresoras médicas (DRYPIX)
        medical_printers = []
        for printer in printers:
            if printer.model and 'DRYPIX' in printer.model.upper():
                medical_printers.append({
                    'id': printer.id,
                    'brand': printer.brand,
                    'model': printer.model,
                    'serial_number': printer.serial_number,
                    'asset_tag': printer.asset_tag,
                    'ip': printer.ip,
                    'hostname': printer.hostname,
                    'status': printer.status,
                    'location': printer.location,
                    'department': printer.department,
                    'responsible_person': printer.responsible_person,
                    'created_at': printer.created_at.isoformat() if printer.created_at else None
                })
        
        return {
            'count': len(medical_printers),
            'printers': medical_printers
        }
        
    except Exception as e:
        logger.error(f"Error listing medical printers: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al listar impresoras médicas: {str(e)}"
        )

@router.get("/{printer_id}/test-connection")
async def test_medical_printer_connection(printer_id: int, db: Session = Depends(get_db)):
    """
    Prueba la conexión HTTP con una impresora médica
    """
    try:
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        if 'DRYPIX' not in printer.model.upper():
            raise HTTPException(
                status_code=400,
                detail="This endpoint is only for DRYPIX medical printers"
            )
        
        start_time = datetime.now()
        
        # Intentar autenticar
        scraper = DrypixScraper(printer.ip, 20051)
        authenticated = scraper.authenticate()
        
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds()
        
        if authenticated:
            return {
                'success': True,
                'printer_id': printer.id,
                'ip': printer.ip,
                'port': 20051,
                'authenticated': True,
                'response_time': response_time,
                'message': 'Conexión exitosa a la impresora DRYPIX',
                'web_url': f'http://{printer.ip}:20051/USER/Login.htm'
            }
        else:
            return {
                'success': False,
                'printer_id': printer.id,
                'ip': printer.ip,
                'port': 20051,
                'authenticated': False,
                'response_time': response_time,
                'message': 'No se pudo autenticar en la impresora',
                'web_url': f'http://{printer.ip}:20051/USER/Login.htm'
            }
            
    except Exception as e:
        logger.error(f"Error testing medical printer connection: {str(e)}")
        return {
            'success': False,
            'printer_id': printer_id,
            'error': str(e),
            'message': f'Error al conectar: {str(e)}'
        }

@router.get("/{printer_id}/print-history")
async def get_print_history(printer_id: int, days: int = 30, db: Session = Depends(get_db)):
    """
    Obtiene el historial de impresión día a día de una impresora médica
    """
    try:
        # Verificar que la impresora existe
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        logger.info(f"Fetching print history for medical printer {printer_id}")
        
        # Calcular fecha de inicio
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Obtener registros de contadores desde la tabla histórica
        counters = db.query(MedicalPrinterCounter).filter(
            MedicalPrinterCounter.printer_id == printer_id,
            MedicalPrinterCounter.timestamp >= start_date
        ).order_by(desc(MedicalPrinterCounter.timestamp)).all()
        
        if not counters:
            # Si no hay historial, intentar obtener datos actuales
            try:
                scraper = DrypixScraper(printer.ip)
                result = scraper.get_counters()
                
                if result:
                    current_date = datetime.now()
                    # Guardar también en la base de datos
                    try:
                        counter_record = MedicalPrinterCounter(
                            printer_id=printer.id,
                            timestamp=current_date,
                            total_printed=result['summary']['total_printed'],
                            total_available=result['summary']['total_available'],
                            total_trays_loaded=result['summary']['total_trays_loaded'],
                            is_online=result['is_online'],
                            raw_data=json.dumps(result),
                            collection_method='manual'
                        )
                        db.add(counter_record)
                        db.commit()
                    except Exception as save_error:
                        logger.error(f"Error saving counter: {save_error}")
                        db.rollback()
                    
                    return [{
                        "date": current_date.date().isoformat(),
                        "timestamp": current_date.isoformat(),
                        "total_printed": result['summary']['total_printed'],
                        "total_available": result['summary']['total_available'],
                        "total_trays_loaded": result['summary']['total_trays_loaded'],
                        "is_online": result['is_online']
                    }]
            except Exception as scraper_error:
                logger.error(f"Error fetching current data: {scraper_error}")
            
            return []
        
        # Agrupar por día y tomar el último registro de cada día
        daily_history = {}
        for counter in counters:
            date_key = counter.timestamp.date().isoformat()
            
            # Solo guardar el primer registro de cada día (ya que están ordenados desc)
            if date_key not in daily_history:
                daily_history[date_key] = {
                    'date': date_key,
                    'timestamp': counter.timestamp.isoformat(),
                    'total_printed': counter.total_printed,
                    'total_available': counter.total_available,
                    'total_trays_loaded': counter.total_trays_loaded,
                    'is_online': counter.is_online
                }
        
        # Convertir a lista y ordenar por fecha descendente
        history_list = sorted(daily_history.values(), key=lambda x: x['date'], reverse=True)
        
        return history_list
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting print history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener historial: {str(e)}"
        )

@router.delete("/{printer_id}/history")
async def clear_print_history(printer_id: int, db: Session = Depends(get_db)):
    """
    Elimina todo el historial de contadores de una impresora médica específica.
    Útil cuando se cambia un cartucho o se necesita reiniciar el seguimiento.
    """
    try:
        # Verificar que la impresora existe
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        if 'DRYPIX' not in printer.model.upper():
            raise HTTPException(
                status_code=400,
                detail="This endpoint is only for DRYPIX medical printers"
            )
        
        logger.info(f"Clearing print history for medical printer {printer_id}")
        
        # Contar registros antes de eliminar
        count = db.query(MedicalPrinterCounter).filter(
            MedicalPrinterCounter.printer_id == printer_id
        ).count()
        
        # Eliminar todos los registros de contador de esta impresora
        db.query(MedicalPrinterCounter).filter(
            MedicalPrinterCounter.printer_id == printer_id
        ).delete()
        
        db.commit()
        
        logger.info(f"Successfully deleted {count} counter records for printer {printer_id}")
        
        return {
            "success": True,
            "printer_id": printer_id,
            "printer_name": f"{printer.brand} {printer.model}",
            "deleted_records": count,
            "message": f"Se eliminaron {count} registros del historial"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing print history: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar historial: {str(e)}"
        )

@router.post("/collect-all-counters")
async def collect_all_medical_counters(db: Session = Depends(get_db)):
    """
    Ejecuta manualmente la recolección de contadores de todas las impresoras médicas
    Útil para testing y para forzar una actualización inmediata
    """
    try:
        # Get all active DRYPIX printers
        medical_printers = db.query(Printer).filter(
            Printer.status == "active",
            Printer.model.ilike("%DRYPIX%")
        ).all()
        
        if not medical_printers:
            return {
                "success": True,
                "message": "No active medical printers found",
                "collected": 0,
                "failed": 0,
                "details": []
            }
        
        logger.info(f"Manual collection started for {len(medical_printers)} medical printers")
        
        success_count = 0
        error_count = 0
        details = []
        
        for printer in medical_printers:
            try:
                scraper = DrypixScraper(printer.ip, 20051)
                result = scraper.get_counters()
                
                if result:
                    # Save counter snapshot
                    counter_record = MedicalPrinterCounter(
                        printer_id=printer.id,
                        timestamp=datetime.now(),
                        total_printed=result['summary']['total_printed'],
                        total_available=result['summary']['total_available'],
                        total_trays_loaded=result['summary']['total_trays_loaded'],
                        is_online=result['is_online'],
                        raw_data=json.dumps(result),
                        collection_method='manual'
                    )
                    
                    db.add(counter_record)
                    db.commit()
                    success_count += 1
                    
                    details.append({
                        "printer_id": printer.id,
                        "printer_name": f"{printer.brand} {printer.model}",
                        "ip": printer.ip,
                        "success": True,
                        "total_printed": result['summary']['total_printed'],
                        "total_available": result['summary']['total_available']
                    })
                    
                    logger.info(f"Successfully collected counters for printer {printer.id}")
                else:
                    error_count += 1
                    details.append({
                        "printer_id": printer.id,
                        "printer_name": f"{printer.brand} {printer.model}",
                        "ip": printer.ip,
                        "success": False,
                        "error": "Failed to get counters from printer"
                    })
                    logger.warning(f"Failed to get counters from printer {printer.id}")
                
            except Exception as e:
                error_count += 1
                details.append({
                    "printer_id": printer.id,
                    "printer_name": f"{printer.brand} {printer.model}",
                    "ip": printer.ip,
                    "success": False,
                    "error": str(e)
                })
                logger.error(f"Error collecting counters for printer {printer.id}: {str(e)}")
                db.rollback()
                continue
        
        return {
            "success": True,
            "message": f"Collection completed: {success_count} successful, {error_count} failed",
            "collected": success_count,
            "failed": error_count,
            "total_printers": len(medical_printers),
            "details": details
        }
        
    except Exception as e:
        logger.error(f"Error in manual collection: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error en recolección manual: {str(e)}"
        )

class UptimeResponse(BaseModel):
    uptime_percentage: float
    total_records: int
    online_records: int
    offline_records: int
    period_days: int
    first_record_date: Optional[str]
    last_record_date: Optional[str]
    current_status: str

@router.get("/{printer_id}/uptime", response_model=UptimeResponse)
async def get_printer_uptime(
    printer_id: int, 
    days: int = 7, 
    db: Session = Depends(get_db)
):
    """
    Calcula el uptime real de una impresora médica basado en el histórico de is_online.
    
    Args:
        printer_id: ID de la impresora
        days: Período de días a analizar (default: 7)
    
    Returns:
        UptimeResponse con porcentaje de uptime y estadísticas
    """
    try:
        # Verificar que la impresora existe
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        if 'DRYPIX' not in printer.model.upper():
            raise HTTPException(
                status_code=400,
                detail="This endpoint is only for DRYPIX medical printers"
            )
        
        logger.info(f"Calculating uptime for printer {printer_id} over {days} days")
        
        # Calcular fecha de inicio
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Obtener todos los registros del período
        records = db.query(MedicalPrinterCounter).filter(
            MedicalPrinterCounter.printer_id == printer_id,
            MedicalPrinterCounter.timestamp >= start_date,
            MedicalPrinterCounter.timestamp <= end_date
        ).order_by(MedicalPrinterCounter.timestamp).all()
        
        if not records:
            # Si no hay registros históricos, intentar obtener estado actual
            try:
                scraper = DrypixScraper(printer.ip, 20051)
                result = scraper.get_counters()
                
                if result:
                    current_status = "online" if result.get('is_online', False) else "offline"
                    return UptimeResponse(
                        uptime_percentage=100.0 if result.get('is_online', False) else 0.0,
                        total_records=1,
                        online_records=1 if result.get('is_online', False) else 0,
                        offline_records=0 if result.get('is_online', False) else 1,
                        period_days=days,
                        first_record_date=datetime.utcnow().isoformat(),
                        last_record_date=datetime.utcnow().isoformat(),
                        current_status=current_status
                    )
            except Exception as scraper_error:
                logger.error(f"Error fetching current status: {scraper_error}")
            
            # Sin datos y sin conexión actual
            return UptimeResponse(
                uptime_percentage=0.0,
                total_records=0,
                online_records=0,
                offline_records=0,
                period_days=days,
                first_record_date=None,
                last_record_date=None,
                current_status="unknown"
            )
        
        # Calcular estadísticas
        total_records = len(records)
        online_records = sum(1 for r in records if r.is_online)
        offline_records = total_records - online_records
        
        # Calcular porcentaje de uptime
        uptime_percentage = (online_records / total_records) * 100 if total_records > 0 else 0.0
        
        # Obtener fechas
        first_record = records[0]
        last_record = records[-1]
        
        # Determinar estado actual
        current_status = "online" if last_record.is_online else "offline"
        
        logger.info(
            f"Uptime calculated for printer {printer_id}: "
            f"{uptime_percentage:.2f}% ({online_records}/{total_records} records online)"
        )
        
        return UptimeResponse(
            uptime_percentage=round(uptime_percentage, 2),
            total_records=total_records,
            online_records=online_records,
            offline_records=offline_records,
            period_days=days,
            first_record_date=first_record.timestamp.isoformat(),
            last_record_date=last_record.timestamp.isoformat(),
            current_status=current_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating uptime: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al calcular uptime: {str(e)}"
        )
