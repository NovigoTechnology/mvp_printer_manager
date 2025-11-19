from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import logging
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from pydantic import BaseModel

from ..db import get_db
from ..models import Printer, MonthlyCounter
from ..services.snmp import SNMPService

router = APIRouter()
logger = logging.getLogger(__name__)

class CounterCollectionResult(BaseModel):
    success: bool
    message: str
    printers_processed: int
    printers_successful: int
    printers_failed: int
    counters_created: int
    counters_updated: int
    errors: List[str]
    execution_time: float
    results: List[Dict[str, Any]]

class PrinterCounterData(BaseModel):
    printer_id: int
    printer_ip: str
    printer_name: str
    success: bool
    counter_bw: Optional[int] = None
    counter_color: Optional[int] = None
    counter_total: Optional[int] = None
    profile_used: Optional[str] = None
    response_time: Optional[float] = None
    error_message: Optional[str] = None
    action_taken: Optional[str] = None  # 'created', 'updated', 'skipped'
    ping_check: Optional[bool] = None  # True if ping successful, False if failed

def ping_printer(ip: str, timeout: float = 0.5) -> Dict[str, Any]:
    """
    Verifica conectividad de la impresora antes de intentar SNMP
    Optimizado para ser rápido y evitar timeouts largos
    """
    start_time = datetime.now()
    
    # Puertos de impresoras en orden de prioridad para conexión rápida
    printer_ports = [
        80,   # HTTP - Muy común en impresoras modernas
        9100, # Raw printing (HP JetDirect)
        161,  # SNMP - El que necesitamos eventualmente
        515,  # LPR (Line Printer Remote)
        631,  # IPP (Internet Printing Protocol)
    ]
    
    # Probar cada puerto con timeout rápido
    for port in printer_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            
            if result == 0:
                end_time = datetime.now()
                response_time = (end_time - start_time).total_seconds()
                return {
                    'success': True,
                    'response_time': response_time,
                    'port_responsive': port,
                    'error': None
                }
        except Exception:
            continue
    
    # Si ningún puerto respondió
    end_time = datetime.now()
    response_time = (end_time - start_time).total_seconds()
    return {
        'success': False,
        'response_time': response_time,
        'port_responsive': None,
        'error': 'No hay conectividad - impresora apagada o fuera de línea'
    }

def process_single_printer_threaded(printer_dict: Dict, year: int = None, month: int = None, previous_counters_cache: Dict[int, MonthlyCounter] = None) -> PrinterCounterData:
    """
    Procesa una impresora individual de forma thread-safe
    Recibe un diccionario con los datos de la impresora para evitar problemas de serialización
    """
    from ..db import get_db
    
    # Crear una nueva sesión de base de datos para este hilo
    db = next(get_db())
    
    try:
        printer_result = PrinterCounterData(
            printer_id=printer_dict['id'],
            printer_ip=printer_dict['ip'],
            printer_name=f"{printer_dict['brand']} {printer_dict['model']}",
            success=False
        )
        
        logger.info(f"[Thread] Processing printer {printer_dict['id']}: {printer_dict['brand']} {printer_dict['model']} ({printer_dict['ip']})")
        
        # Verificar conectividad antes de SNMP (timeout optimizado para paralelización)
        ping_result = ping_printer(printer_dict['ip'], timeout=0.3)
        printer_result.ping_check = ping_result['success']
        
        if not ping_result['success']:
            printer_result.error_message = f"Sin conectividad: {ping_result['error']}"
            printer_result.response_time = ping_result['response_time']
            logger.warning(f"[Thread] No connectivity for printer {printer_dict['id']} - {ping_result['error']}")
            return printer_result
        
        logger.info(f"[Thread] Connectivity OK for {printer_dict['ip']} (port {ping_result['port_responsive']}, {ping_result['response_time']:.3f}s)")
        
        # Obtener contadores vía SNMP (usar función estándar por ahora)
        snmp_result = get_printer_counters_via_snmp(printer_dict['ip'], printer_dict['snmp_profile'])
        printer_result.response_time = snmp_result['response_time']
        
        if snmp_result['success']:
            counters = snmp_result['counters']
            printer_result.counter_bw = counters['bw_counter']
            printer_result.counter_color = counters['color_counter']
            printer_result.counter_total = counters['total_counter']
            printer_result.profile_used = counters['profile_used']
            
            # Crear o actualizar registro MonthlyCounter (thread-safe con cache)
            action, counter_record = create_or_update_monthly_counter(
                printer_id=printer_dict['id'],
                counter_bw=counters['bw_counter'],
                counter_color=counters['color_counter'],
                counter_total=counters['total_counter'],
                db=db,
                year=year,
                month=month,
                previous_counters_cache=previous_counters_cache
            )
            
            printer_result.action_taken = action
            printer_result.success = True
            logger.info(f"[Thread] Successfully processed printer {printer_dict['id']}: {action} counter record")
            
        else:
            printer_result.error_message = snmp_result['error']
            logger.error(f"[Thread] SNMP failed for printer {printer_dict['id']}: {snmp_result['error']}")
        
        return printer_result
        
    except Exception as e:
        error_msg = f"Thread error processing printer {printer_dict['id']}: {str(e)}"
        logger.error(error_msg)
        printer_result.error_message = error_msg
        return printer_result
    
    finally:
        # Cerrar la sesión de base de datos del hilo
        db.close()

def get_printer_counters_via_snmp(printer_ip: str, printer_profile: str = None) -> Dict[str, Any]:
    """
    Obtiene los contadores acumulativos de una impresora via SNMP
    Estos son los valores totales desde que se encendió la impresora por primera vez
    """
    try:
        start_time = datetime.now()
        snmp_service = SNMPService()
        
        # Determinar perfiles a probar basado en el perfil de la impresora
        if printer_profile:
            profiles = [printer_profile, 'generic_v2c']
        else:
            profiles = ['hp', 'oki', 'brother', 'generic_v2c']
        
        best_result = None
        
        for profile in profiles:
            try:
                logger.info(f"Trying profile {profile} for printer {printer_ip}")
                
                # Obtener OIDs específicos para contadores acumulativos de páginas
                if profile == 'hp':
                    # HP - Contadores acumulativos específicos
                    bw_oid = '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.1'  # HP B&W pages
                    color_oid = '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.2'  # HP Color pages
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'  # Standard total pages
                elif profile == 'oki':
                    # OKI - Contadores específicos
                    bw_oid = '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.999.1'  # OKI B&W
                    color_oid = '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.999.2'  # OKI Color
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'  # Standard total
                elif profile == 'brother':
                    # Brother - Contadores específicos
                    bw_oid = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0'  # Brother B&W
                    color_oid = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11.0'  # Brother Color
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'  # Standard total
                else:  # generic_v2c o otros
                    # OIDs estándar
                    bw_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'  # Standard total (usado como B&W)
                    color_oid = '1.3.6.1.2.1.43.10.2.1.4.1.2'  # Intento de color estándar
                    total_oid = '1.3.6.1.2.1.43.10.2.1.4.1.1'  # Standard total
                
                # Realizar las consultas SNMP
                logger.info(f"Querying SNMP for {printer_ip} using profile {profile}")
                bw_counter = snmp_service.get_snmp_value(printer_ip, bw_oid)
                color_counter = snmp_service.get_snmp_value(printer_ip, color_oid)
                total_counter = snmp_service.get_snmp_value(printer_ip, total_oid)
                
                logger.info(f"Raw SNMP values - BW: {bw_counter}, Color: {color_counter}, Total: {total_counter}")
                
                # Convertir a enteros con validación
                bw_value = None
                color_value = None
                total_value = None
                
                if bw_counter and str(bw_counter).isdigit():
                    bw_value = int(bw_counter)
                
                if color_counter and str(color_counter).isdigit():
                    color_value = int(color_counter)
                
                if total_counter and str(total_counter).isdigit():
                    total_value = int(total_counter)
                
                # Para impresoras solo B&W, el color debe ser 0
                if color_value is None:
                    color_value = 0
                
                # Si no tenemos B&W pero tenemos total, usar total como B&W
                if bw_value is None and total_value is not None:
                    bw_value = total_value
                
                # Si tenemos al menos el contador B&W, consideramos exitoso
                if bw_value is not None:
                    best_result = {
                        'bw_counter': bw_value,
                        'color_counter': color_value or 0,
                        'total_counter': total_value or bw_value,
                        'profile_used': profile
                    }
                    logger.info(f"Successfully got counters with profile {profile}: BW={bw_value}, Color={color_value}, Total={total_value}")
                    break
                else:
                    logger.warning(f"Profile {profile} didn't return valid counters")
                    
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

def create_or_update_monthly_counter(
    printer_id: int, 
    counter_bw: int, 
    counter_color: int, 
    counter_total: int,
    db: Session,
    year: int = None,
    month: int = None,
    previous_counters_cache: Dict[int, MonthlyCounter] = None
) -> tuple[str, MonthlyCounter]:
    """
    Crea o actualiza un registro de contador mensual
    Los campos previous_counter contienen los valores del día anterior (último registro)
    para calcular páginas impresas desde la última lectura
    Retorna: (acción_tomada, registro_contador)
    """
    now = datetime.now()
    year = year or now.year
    month = month or now.month
    
    # NUEVA LÓGICA: Siempre crear un nuevo registro (para historial completo)
    # Comentar las siguientes líneas para deshabilitar la búsqueda de registros existentes
    # y forzar la creación de un nuevo registro en cada recolección
    
    existing_counter = None  # Forzar creación de nuevo registro
    
    # LÓGICA ORIGINAL (comentada):
    # Buscar registro existente para HOY (mismo día)
    # today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    # 
    # existing_counter = db.query(MonthlyCounter).filter(
    #     and_(
    #         MonthlyCounter.printer_id == printer_id,
    #         MonthlyCounter.year == year,
    #         MonthlyCounter.month == month,
    #         MonthlyCounter.recorded_at >= today_start,
    #         MonthlyCounter.recorded_at <= today_end
    #     )
    # ).first()
    
    if existing_counter:
        # Actualizar registro existente solo si no está bloqueado
        if not existing_counter.locked:
            # Calcular páginas impresas basado en contador anterior
            prev_bw = existing_counter.previous_counter_bw
            prev_color = existing_counter.previous_counter_color
            prev_total = existing_counter.previous_counter_total
            
            existing_counter.counter_bw = counter_bw
            existing_counter.counter_color = counter_color
            existing_counter.counter_total = counter_total
            
            # Recalcular páginas impresas
            existing_counter.pages_printed_bw = max(0, counter_bw - prev_bw)
            existing_counter.pages_printed_color = max(0, counter_color - prev_color)
            existing_counter.pages_printed_total = max(0, counter_total - prev_total)
            
            existing_counter.updated_at = now
            
            db.commit()
            db.refresh(existing_counter)
            
            return ("updated", existing_counter)
        else:
            return ("skipped", existing_counter)
    
    else:
        # Crear nuevo registro
        # Usar cache de contadores anteriores si está disponible, o hacer query individual
        if previous_counters_cache and printer_id in previous_counters_cache:
            prev_counter = previous_counters_cache[printer_id]
        else:
            # Fallback: buscar el contador del día anterior más reciente 
            prev_counter = db.query(MonthlyCounter).filter(
                MonthlyCounter.printer_id == printer_id
            ).order_by(MonthlyCounter.recorded_at.desc()).first()
        
        # Valores anteriores (0 si no hay registro previo)
        prev_bw = prev_counter.counter_bw if prev_counter else 0
        prev_color = prev_counter.counter_color if prev_counter else 0
        prev_total = prev_counter.counter_total if prev_counter else 0
        
        # Calcular páginas impresas desde la última lectura
        pages_bw = max(0, counter_bw - prev_bw)
        pages_color = max(0, counter_color - prev_color)
        pages_total = max(0, counter_total - prev_total)
        
        # Crear nuevo registro
        new_counter = MonthlyCounter(
            printer_id=printer_id,
            year=year,
            month=month,
            counter_bw=counter_bw,
            counter_color=counter_color,
            counter_total=counter_total,
            previous_counter_bw=prev_bw,
            previous_counter_color=prev_color,
            previous_counter_total=prev_total,
            pages_printed_bw=pages_bw,
            pages_printed_color=pages_color,
            pages_printed_total=pages_total,
            notes=f"Contador automático - {now.strftime('%Y-%m-%d %H:%M')}",
            locked=False,  # Por defecto no bloqueado para permitir ajustes
            recorded_at=now
        )
        
        db.add(new_counter)
        # Commit individual para thread-safety (batch commits se harían a nivel superior)
        db.commit()
        db.refresh(new_counter)
        
        return ("created", new_counter)

@router.post("/collect", response_model=CounterCollectionResult)
def collect_all_counters(
    background_tasks: BackgroundTasks,
    year: Optional[int] = None,
    month: Optional[int] = None,
    printer_ids: Optional[str] = None,  # Cambiar a string para recibir comma-separated
    lease_contract: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Recolecta contadores de todas las impresoras activas (o las especificadas) vía SNMP
    y crea/actualiza registros MonthlyCounter
    """
    start_time = datetime.now()
    errors = []
    results = []
    printers_processed = 0
    printers_successful = 0
    printers_failed = 0
    counters_created = 0
    counters_updated = 0
    
    try:
        # Obtener impresoras a procesar
        query = db.query(Printer).filter(Printer.status == "active")
        
        # Filtrar por IDs específicos si se proporcionan
        if printer_ids:
            try:
                ids_list = [int(id.strip()) for id in printer_ids.split(',') if id.strip()]
                query = query.filter(Printer.id.in_(ids_list))
                logger.info(f"Filtering by printer IDs: {ids_list}")
            except ValueError as e:
                return CounterCollectionResult(
                    success=False,
                    message=f"Invalid printer IDs format: {printer_ids}",
                    printers_processed=0,
                    printers_successful=0,
                    printers_failed=0,
                    counters_created=0,
                    counters_updated=0,
                    errors=[f"Invalid printer IDs: {str(e)}"],
                    execution_time=0.0,
                    results=[]
                )
        
        # Filtrar por contrato si se proporciona
        if lease_contract:
            query = query.filter(Printer.lease_contract == lease_contract)
            logger.info(f"Filtering by lease contract: {lease_contract}")
        
        printers = query.all()
        
        if not printers:
            filter_type = "all active printers"
            if printer_ids:
                filter_type = f"printer IDs: {printer_ids}"
            elif lease_contract:
                filter_type = f"lease contract: {lease_contract}"
                
            return CounterCollectionResult(
                success=False,
                message=f"No hay impresoras activas para procesar ({filter_type})",
                printers_processed=0,
                printers_successful=0,
                printers_failed=0,
                counters_created=0,
                counters_updated=0,
                errors=[f"No active printers found for {filter_type}"],
                execution_time=0.0,
                results=[]
            )
        
        filter_info = ""
        if printer_ids:
            filter_info = f" (filtered by IDs: {printer_ids})"
        elif lease_contract:
            filter_info = f" (filtered by lease contract: {lease_contract})"
        
        logger.info(f"Starting PARALLEL counter collection for {len(printers)} printers{filter_info}")
        
        # PRE-CARGA: Obtener todos los contadores anteriores en una sola consulta optimizada
        logger.info("Pre-loading previous counters for all printers...")
        printer_ids = [p.id for p in printers]
        
        # Subconsulta para obtener el último contador de cada impresora
        from sqlalchemy import func
        subquery = db.query(
            MonthlyCounter.printer_id,
            func.max(MonthlyCounter.recorded_at).label('max_recorded_at')
        ).filter(
            MonthlyCounter.printer_id.in_(printer_ids)
        ).group_by(MonthlyCounter.printer_id).subquery()
        
        # Consulta principal para obtener los registros completos
        previous_counters = db.query(MonthlyCounter).join(
            subquery,
            (MonthlyCounter.printer_id == subquery.c.printer_id) &
            (MonthlyCounter.recorded_at == subquery.c.max_recorded_at)
        ).all()
        
        # Crear cache (diccionario) de contadores anteriores
        previous_counters_cache = {counter.printer_id: counter for counter in previous_counters}
        logger.info(f"Pre-loaded {len(previous_counters_cache)} previous counter records")
        
        # Convertir objetos Printer a diccionarios para thread-safety
        printer_data_list = []
        for printer in printers:
            printer_data_list.append({
                'id': printer.id,
                'ip': printer.ip,
                'brand': printer.brand,
                'model': printer.model,
                'snmp_profile': printer.snmp_profile
            })
        
        # Calcular número óptimo de workers (máximo 10 para no saturar la red)
        max_workers = min(len(printers), 10)
        logger.info(f"Using {max_workers} parallel workers for processing")
        
        # Procesamiento paralelo con ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Enviar todas las tareas con cache de contadores anteriores
            future_to_printer = {
                executor.submit(process_single_printer_threaded, printer_data, year, month, previous_counters_cache): printer_data 
                for printer_data in printer_data_list
            }
            
            # Recolectar resultados conforme se completen
            for future in as_completed(future_to_printer):
                printer_data = future_to_printer[future]
                printers_processed += 1
                
                try:
                    printer_result = future.result()
                    
                    # Compilar estadísticas thread-safe
                    if printer_result.success:
                        printers_successful += 1
                        if printer_result.action_taken == "created":
                            counters_created += 1
                        elif printer_result.action_taken == "updated":
                            counters_updated += 1
                    else:
                        printers_failed += 1
                        if printer_result.error_message:
                            errors.append(f"Printer {printer_data['id']} ({printer_data['ip']}): {printer_result.error_message}")
                    
                    results.append(printer_result.dict())
                    logger.info(f"Completed printer {printer_data['id']}: success={printer_result.success}")
                    
                except Exception as e:
                    # Error en el futuro
                    error_msg = f"Future error for printer {printer_data['id']}: {str(e)}"
                    printers_failed += 1
                    errors.append(error_msg)
                    logger.error(error_msg)
                    
                    # Agregar resultado fallido
                    failed_result = PrinterCounterData(
                        printer_id=printer_data['id'],
                        printer_ip=printer_data['ip'],
                        printer_name=f"{printer_data['brand']} {printer_data['model']}",
                        success=False,
                        error_message=error_msg
                    )
                    results.append(failed_result.dict())
        
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        
        success = printers_failed == 0
        message = f"Processed {printers_processed} printers: {printers_successful} successful, {printers_failed} failed. Created {counters_created}, updated {counters_updated} counter records."
        
        logger.info(f"Counter collection completed: {message}")
        
        return CounterCollectionResult(
            success=success,
            message=message,
            printers_processed=printers_processed,
            printers_successful=printers_successful,
            printers_failed=printers_failed,
            counters_created=counters_created,
            counters_updated=counters_updated,
            errors=errors,
            execution_time=execution_time,
            results=results
        )
        
    except Exception as e:
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        error_msg = f"Fatal error in counter collection: {str(e)}"
        logger.error(error_msg)
        
        return CounterCollectionResult(
            success=False,
            message=error_msg,
            printers_processed=printers_processed,
            printers_successful=printers_successful,
            printers_failed=printers_failed,
            counters_created=counters_created,
            counters_updated=counters_updated,
            errors=[error_msg],
            execution_time=execution_time,
            results=results
        )

@router.post("/collect/{printer_id}", response_model=PrinterCounterData)
def collect_single_printer_counter(
    printer_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Recolecta contadores de una impresora específica vía SNMP
    """
    try:
        # Obtener impresora
        printer = db.query(Printer).filter(
            and_(Printer.id == printer_id, Printer.status == "active")
        ).first()
        
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found or not active")
        
        logger.info(f"Collecting counters for printer {printer.id}: {printer.brand} {printer.model} ({printer.ip})")
        
        # Verificar conectividad antes de SNMP
        logger.info(f"Checking connectivity for printer {printer.ip}...")
        ping_result = ping_printer(printer.ip, timeout=1.0)
        
        result = PrinterCounterData(
            printer_id=printer.id,
            printer_ip=printer.ip,
            printer_name=f"{printer.brand} {printer.model}",
            success=False,
            response_time=ping_result['response_time'],
            ping_check=ping_result['success']
        )
        
        if not ping_result['success']:
            # Si no hay conectividad, retornar error inmediatamente
            result.error_message = f"Sin conectividad: {ping_result['error']}"
            logger.warning(f"No connectivity for printer {printer.id}: {ping_result['error']}")
            return result
        
        logger.info(f"Connectivity OK for {printer.ip}, proceeding with SNMP...")
        
        # Obtener contadores vía SNMP (solo si hay conectividad)
        snmp_result = get_printer_counters_via_snmp(printer.ip, printer.snmp_profile)
        
        # Actualizar el objeto result con datos de SNMP
        result.success = snmp_result['success']
        result.response_time = snmp_result['response_time']
        
        if snmp_result['success']:
            counters = snmp_result['counters']
            result.counter_bw = counters['bw_counter']
            result.counter_color = counters['color_counter']
            result.counter_total = counters['total_counter']
            result.profile_used = counters['profile_used']
            
            # Crear o actualizar registro MonthlyCounter
            action, counter_record = create_or_update_monthly_counter(
                printer_id=printer.id,
                counter_bw=counters['bw_counter'],
                counter_color=counters['color_counter'],
                counter_total=counters['total_counter'],
                db=db,
                year=year,
                month=month
            )
            
            result.action_taken = action
            logger.info(f"Successfully processed printer {printer.id}: {action} counter record")
            
        else:
            result.error_message = snmp_result['error']
            logger.error(f"Failed to get counters for printer {printer.id}: {snmp_result['error']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error processing printer {printer_id}: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@router.get("/test/{printer_id}")
def test_printer_snmp(printer_id: int, db: Session = Depends(get_db)):
    """
    Prueba la conectividad SNMP con una impresora específica sin crear registros
    """
    try:
        # Obtener impresora
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        logger.info(f"Testing connectivity and SNMP for printer {printer.id}: {printer.brand} {printer.model} ({printer.ip})")
        
        # Primero probar conectividad básica
        logger.info(f"Testing basic connectivity for {printer.ip}...")
        ping_result = ping_printer(printer.ip, timeout=1.0)
        
        # Luego probar SNMP solo si hay conectividad
        if ping_result['success']:
            logger.info(f"Connectivity OK, testing SNMP for {printer.ip}...")
            snmp_result = get_printer_counters_via_snmp(printer.ip, printer.snmp_profile)
        else:
            logger.warning(f"No connectivity for {printer.ip}, skipping SNMP test")
            snmp_result = {
                'success': False,
                'response_time': ping_result['response_time'],
                'error': f"No connectivity: {ping_result['error']}"
            }
        
        return {
            "printer_id": printer.id,
            "printer_name": f"{printer.brand} {printer.model}",
            "printer_ip": printer.ip,
            "snmp_profile": printer.snmp_profile,
            "ping_result": ping_result,
            "snmp_result": snmp_result,
            "overall_success": ping_result['success'] and snmp_result['success']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error testing printer {printer_id}: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

# Modelos para el historial de ejecuciones
class ExecutionHistoryEntry(BaseModel):
    id: int
    execution_time: datetime
    success: bool
    printers_processed: int
    printers_successful: int
    printers_failed: int
    execution_duration_seconds: Optional[float]
    error_message: Optional[str] = None
    details: Optional[str] = None

class ExecutionHistorySave(BaseModel):
    success: bool
    printers_processed: int
    printers_successful: int
    printers_failed: int
    execution_duration_seconds: float
    error_message: Optional[str] = None
    details: Optional[str] = None

@router.get("/history", response_model=List[ExecutionHistoryEntry])
async def get_execution_history(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Obtiene el historial de ejecuciones de recolección de contadores"""
    try:
        # Importar el modelo aquí para evitar problemas de importación circular
        from ..models import CounterScheduleExecution
        
        executions = db.query(CounterScheduleExecution)\
                      .order_by(CounterScheduleExecution.execution_time.desc())\
                      .limit(limit)\
                      .all()
        
        result = []
        for execution in executions:
            result.append(ExecutionHistoryEntry(
                id=execution.id,
                execution_time=execution.execution_time,
                success=execution.success,
                printers_processed=execution.printers_processed or 0,
                printers_successful=execution.printers_successful or 0,
                printers_failed=execution.printers_failed or 0,
                execution_duration_seconds=execution.execution_duration_seconds,
                error_message=execution.error_message,
                details=execution.details
            ))
        
        return result
        
    except Exception as e:
        error_msg = f"Error retrieving execution history: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/manual-record")
async def create_manual_record(
    printer_id: int,
    counter_bw: int,
    counter_color: int = 0,
    counter_total: int = None,
    notes: str = None,
    db: Session = Depends(get_db)
):
    """Endpoint temporal para crear registros manuales (testing)"""
    try:
        counter_total = counter_total or counter_bw + counter_color
        now = datetime.now()
        
        action, record = create_or_update_monthly_counter(
            printer_id=printer_id,
            counter_bw=counter_bw,
            counter_color=counter_color,
            counter_total=counter_total,
            db=db,
            year=now.year,
            month=now.month
        )
        
        if notes and action == "created":
            record.notes = notes
            db.commit()
        
        return {
            "success": True,
            "action": action,
            "record_id": record.id,
            "message": f"Record {action} successfully",
            "data": {
                "id": record.id,
                "printer_id": record.printer_id,
                "counter_bw": record.counter_bw,
                "recorded_at": record.recorded_at,
                "created_at": record.created_at
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/history")
async def save_execution_history(
    execution_data: ExecutionHistorySave,
    db: Session = Depends(get_db)
):
    """Guarda una nueva entrada en el historial de ejecuciones"""
    try:
        # Importar el modelo aquí para evitar problemas de importación circular
        from ..models import CounterScheduleExecution
        
        execution = CounterScheduleExecution(
            schedule_id=1,  # ID por defecto para ejecuciones manuales
            execution_time=datetime.now(),
            success=execution_data.success,
            printers_processed=execution_data.printers_processed,
            printers_successful=execution_data.printers_successful,
            printers_failed=execution_data.printers_failed,
            execution_duration_seconds=execution_data.execution_duration_seconds,
            error_message=execution_data.error_message,
            details=execution_data.details
        )
        
        db.add(execution)
        db.commit()
        db.refresh(execution)
        
        return {"success": True, "execution_id": execution.id}
        
    except Exception as e:
        db.rollback()
        error_msg = f"Error saving execution history: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)