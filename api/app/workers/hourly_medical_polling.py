"""
Worker de Polling Horario para Impresoras Médicas
Ejecuta cada 1 hora para crear snapshots y detectar cambios de cartucho
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Printer
from ..services.medical_printer_service import DrypixScraper
from ..services.cartridge_detection_service import CartridgeDetectionService

logger = logging.getLogger(__name__)

def poll_medical_printers_hourly():
    """
    Polling horario de impresoras médicas
    - Ejecutar cada 1 hora
    - Crear snapshots automáticos
    - Detectar cambios de cartucho
    """
    print("=" * 80)
    print(f"🕐 INICIANDO POLLING HORARIO - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 80)
    logger.info("🕐 Iniciando polling horario de impresoras médicas...")
    
    db: Session = SessionLocal()
    try:
        # Obtener todas las impresoras médicas
        medical_printers = db.query(Printer).filter(
            Printer.model.in_(['DRYPIX SMART', 'FCR', 'CR'])
        ).all()
        
        print(f"📋 Encontradas {len(medical_printers)} impresoras médicas")
        
        if not medical_printers:
            logger.info("No hay impresoras médicas registradas")
            return
        
        snapshot_time = datetime.utcnow()
        total_snapshots = 0
        total_changes = 0
        
        for printer in medical_printers:
            try:
                logger.info(f"Polling {printer.brand} {printer.model} (ID: {printer.id}) - {printer.ip}")
                
                # Crear scraper DRYPIX
                scraper = DrypixScraper(
                    ip_address=printer.ip,
                    port=20051,
                    login='dryprinter',
                    password='fujifilm'
                )
                
                # Obtener contadores actuales
                counters = scraper.get_counters()
                
                if not counters or 'trays' not in counters:
                    logger.warning(f"No se pudieron obtener contadores de printer {printer.id}")
                    continue
                
                # Crear snapshot para cada bandeja (trays es un diccionario {Tray1: {available, printed}, ...})
                for tray_key, tray_data in counters['trays'].items():
                    # Extraer el número de bandeja de la key (Tray1 -> 1)
                    tray_number = int(tray_key.replace('Tray', ''))
                    films_available = tray_data['available']
                    
                    # Solo crear snapshot si la bandeja tiene films disponibles o impresos
                    if films_available == 0 and tray_data['printed'] == 0:
                        continue
                    
                    # Crear snapshot y detectar cambios automáticamente
                    snapshot = CartridgeDetectionService.create_snapshot(
                        db=db,
                        printer_id=printer.id,
                        tray_number=tray_number,
                        films_available=films_available,
                        snapshot_time=snapshot_time
                    )
                    
                    total_snapshots += 1
                    if snapshot.cartridge_change_detected:
                        total_changes += 1
                
            except Exception as e:
                logger.error(f"Error polling printer {printer.id}: {str(e)}")
                continue
        
        print(f"✅ POLLING HORARIO COMPLETADO: {total_snapshots} snapshots, {total_changes} cambios detectados")
        print("=" * 80)
        logger.info(f"✅ Polling horario completado: {total_snapshots} snapshots creados, "
                   f"{total_changes} cambios de cartucho detectados")
        
    except Exception as e:
        print(f"❌ ERROR EN POLLING HORARIO: {str(e)}")
        logger.error(f"Error en polling horario: {str(e)}")
    finally:
        db.close()

def cleanup_old_snapshots_job():
    """
    Job para limpiar snapshots antiguos
    Ejecutar 1x día a las 3:00 AM
    
    Mantiene:
    - Últimos 30 días: todos los snapshots horarios
    - Más de 30 días: solo 1 snapshot por día
    """
    logger.info("🧹 Iniciando limpieza de snapshots antiguos...")
    
    db: Session = SessionLocal()
    try:
        deleted = CartridgeDetectionService.cleanup_old_snapshots(db, days_to_keep=30)
        logger.info(f"✅ Limpieza completada: {deleted} snapshots eliminados")
    except Exception as e:
        logger.error(f"Error en limpieza: {str(e)}")
    finally:
        db.close()
