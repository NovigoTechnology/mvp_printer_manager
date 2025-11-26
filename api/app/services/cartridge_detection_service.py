"""
Servicio de Detección Automática de Cambios de Cartucho
Detecta cambios de cartucho comparando snapshots horarios
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import logging

from ..models import (
    MedicalPrinterSnapshot, 
    MedicalPrinterTrayConfig,
    MedicalPrinterRefill,
    Printer
)

logger = logging.getLogger(__name__)

class CartridgeDetectionService:
    """Servicio para detectar cambios de cartucho automáticamente"""
    
    @staticmethod
    def get_tray_capacity(db: Session, printer_id: int, tray_number: int) -> int:
        """
        Obtener capacidad configurada de una bandeja (default: 100)
        
        Args:
            db: Sesión de base de datos
            printer_id: ID de la impresora
            tray_number: Número de bandeja
            
        Returns:
            Capacidad de la bandeja (films por cartucho)
        """
        config = db.query(MedicalPrinterTrayConfig).filter(
            and_(
                MedicalPrinterTrayConfig.printer_id == printer_id,
                MedicalPrinterTrayConfig.tray_number == tray_number
            )
        ).first()
        
        return config.films_per_cartridge if config else 100
    
    @staticmethod
    def get_last_snapshot(db: Session, printer_id: int, tray_number: int) -> Optional[MedicalPrinterSnapshot]:
        """
        Obtener último snapshot de una bandeja
        
        Args:
            db: Sesión de base de datos
            printer_id: ID de la impresora
            tray_number: Número de bandeja
            
        Returns:
            Último snapshot o None si no existe
        """
        return db.query(MedicalPrinterSnapshot).filter(
            and_(
                MedicalPrinterSnapshot.printer_id == printer_id,
                MedicalPrinterSnapshot.tray_number == tray_number
            )
        ).order_by(desc(MedicalPrinterSnapshot.snapshot_time)).first()
    
    @staticmethod
    def detect_cartridge_change(
        db: Session,
        printer_id: int,
        tray_number: int,
        current_available: int,
        snapshot_time: datetime
    ) -> Dict:
        """
        Detectar si hubo cambio de cartucho comparando con snapshot anterior
        
        Args:
            db: Sesión de base de datos
            printer_id: ID de la impresora
            tray_number: Número de bandeja
            current_available: Films disponibles actuales
            snapshot_time: Momento del snapshot
            
        Returns:
            Dict con información de la detección:
            {
                'change_detected': bool,
                'films_printed': int,
                'previous_available': int,
                'refill_created': bool,
                'refill_id': Optional[int]
            }
        """
        result = {
            'change_detected': False,
            'films_printed': 0,
            'previous_available': 0,
            'refill_created': False,
            'refill_id': None
        }
        
        # Obtener snapshot anterior
        last_snapshot = CartridgeDetectionService.get_last_snapshot(db, printer_id, tray_number)
        
        if not last_snapshot:
            # Primer snapshot, no hay comparación
            logger.info(f"Primer snapshot para printer {printer_id} tray {tray_number}")
            return result
        
        previous_available = last_snapshot.films_available
        result['previous_available'] = previous_available
        
        # Umbral mínimo para detectar cambio de cartucho (evita falsos positivos)
        MIN_INCREMENT_THRESHOLD = 20  # Mínimo 20 films para considerar cambio de cartucho
        
        # Calcular films impresos desde último snapshot
        if current_available <= previous_available:
            # Caso normal: se consumieron films
            films_printed = previous_available - current_available
            result['films_printed'] = films_printed
            logger.debug(f"Printer {printer_id} tray {tray_number}: {films_printed} films impresos")
        else:
            # Incremento detectado en disponibles
            increment = current_available - previous_available
            
            # Solo detectar cambio si el incremento es significativo (>= 20 films)
            if increment >= MIN_INCREMENT_THRESHOLD:
                # ¡DETECCIÓN DE CAMBIO DE CARTUCHO!
                # Disponibles aumentaron significativamente = se cargó cartucho nuevo
                result['change_detected'] = True
            else:
                # Incremento pequeño: probablemente error de lectura o ajuste manual
                # No se detecta como cambio de cartucho
                films_printed = 0  # No se imprimió nada, solo hubo ajuste
                result['films_printed'] = films_printed
                logger.info(f"Printer {printer_id} tray {tray_number}: Incremento pequeño detectado "
                           f"(+{increment} films). No se considera cambio de cartucho (umbral: {MIN_INCREMENT_THRESHOLD})")
                return result
            
            # Calcular cuántos se imprimieron del cartucho anterior
            films_printed_from_old = previous_available  # Se consumió todo lo que quedaba
            result['films_printed'] = films_printed_from_old
            
            logger.info(f"🔄 CAMBIO DE CARTUCHO DETECTADO - Printer {printer_id} Tray {tray_number}")
            logger.info(f"   Anterior: {previous_available} → Actual: {current_available}")
            
            # Crear registro automático de recarga
            capacity = CartridgeDetectionService.get_tray_capacity(db, printer_id, tray_number)
            films_loaded = current_available
            
            refill = MedicalPrinterRefill(
                printer_id=printer_id,
                tray_name=f"Tray{tray_number}",
                cartridge_quantity=1,
                plates_per_cartridge=capacity,
                total_plates_added=films_loaded,
                counter_before_refill=100 - previous_available,
                available_before_refill=previous_available,
                counter_after_refill=100 - current_available,
                available_after_refill=current_available,
                refill_date=snapshot_time,
                auto_detected=True,
                loaded_by='SISTEMA',
                notes=f"Cambio detectado automáticamente. Anterior: {previous_available} films. "
                      f"Nuevo: {current_available} films. Incremento: +{current_available - previous_available}"
            )
            
            db.add(refill)
            db.flush()  # Para obtener el ID
            
            result['refill_created'] = True
            result['refill_id'] = refill.id
            
            logger.info(f"   ✅ Recarga automática creada (ID: {refill.id})")
        
        return result
    
    @staticmethod
    def create_snapshot(
        db: Session,
        printer_id: int,
        tray_number: int,
        films_available: int,
        snapshot_time: datetime = None
    ) -> MedicalPrinterSnapshot:
        """
        Crear snapshot horario y detectar cambios automáticamente
        
        Args:
            db: Sesión de base de datos
            printer_id: ID de la impresora
            tray_number: Número de bandeja
            films_available: Films disponibles
            snapshot_time: Momento del snapshot (default: ahora)
            
        Returns:
            Snapshot creado
        """
        if snapshot_time is None:
            snapshot_time = datetime.utcnow()
        
        # Detectar cambio de cartucho
        detection = CartridgeDetectionService.detect_cartridge_change(
            db, printer_id, tray_number, films_available, snapshot_time
        )
        
        # Crear snapshot
        snapshot = MedicalPrinterSnapshot(
            printer_id=printer_id,
            tray_number=tray_number,
            films_available=films_available,
            films_printed=detection['films_printed'],
            cartridge_change_detected=detection['change_detected'],
            auto_detected=detection['change_detected'],
            snapshot_time=snapshot_time,
            refill_id=detection['refill_id'],
            notes=f"Snapshot horario automático. " + 
                  (f"Cambio de cartucho detectado (+{films_available - detection['previous_available']} films)" 
                   if detection['change_detected'] else f"Impreso: {detection['films_printed']} films")
        )
        
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        
        logger.info(f"📸 Snapshot creado: Printer {printer_id} Tray {tray_number} - "
                   f"{films_available} disponibles, {detection['films_printed']} impresos" +
                   (f" [CAMBIO DETECTADO]" if detection['change_detected'] else ""))
        
        return snapshot
    
    @staticmethod
    def cleanup_old_snapshots(db: Session, days_to_keep: int = 30) -> int:
        """
        Limpiar snapshots antiguos:
        - Últimos 30 días: mantener todos (horarios)
        - Más de 30 días: mantener solo 1 snapshot diario (el primero del día)
        
        Args:
            db: Sesión de base de datos
            days_to_keep: Días de snapshots horarios a mantener
            
        Returns:
            Cantidad de snapshots eliminados
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Obtener snapshots antiguos agrupados por día
        old_snapshots = db.query(MedicalPrinterSnapshot).filter(
            MedicalPrinterSnapshot.snapshot_time < cutoff_date
        ).all()
        
        # Agrupar por (printer_id, tray_number, día)
        daily_snapshots = {}
        for snapshot in old_snapshots:
            day_key = (
                snapshot.printer_id,
                snapshot.tray_number,
                snapshot.snapshot_time.date()
            )
            
            if day_key not in daily_snapshots:
                daily_snapshots[day_key] = []
            daily_snapshots[day_key].append(snapshot)
        
        # Para cada día, mantener solo el primero (más temprano) y eliminar el resto
        deleted_count = 0
        for day_snapshots in daily_snapshots.values():
            if len(day_snapshots) > 1:
                # Ordenar por hora
                day_snapshots.sort(key=lambda s: s.snapshot_time)
                # Mantener el primero, eliminar el resto
                for snapshot in day_snapshots[1:]:
                    db.delete(snapshot)
                    deleted_count += 1
        
        if deleted_count > 0:
            db.commit()
            logger.info(f"🧹 Limpieza completada: {deleted_count} snapshots antiguos eliminados")
        
        return deleted_count
