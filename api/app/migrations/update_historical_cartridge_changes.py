"""
Script para actualizar registros históricos y marcar cambios de cartucho detectados
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import json

# Configuración de base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://printer_user:printer_pass@db:5432/printer_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def update_historical_cartridge_changes():
    """
    Analiza registros históricos y marca cambios de cartucho detectados
    """
    db = SessionLocal()
    
    try:
        # Obtener todos los registros ordenados por impresora y fecha
        query = text("""
            SELECT id, printer_id, timestamp, raw_data, total_available
            FROM medical_printer_counters
            ORDER BY printer_id, timestamp
        """)
        
        records = db.execute(query).fetchall()
        
        print(f"Analizando {len(records)} registros históricos...")
        
        updates_made = 0
        MIN_INCREMENT_THRESHOLD = 20
        
        # Agrupar por impresora
        printers_data = {}
        for record in records:
            printer_id = record.printer_id
            if printer_id not in printers_data:
                printers_data[printer_id] = []
            printers_data[printer_id].append(record)
        
        # Analizar cada impresora
        for printer_id, printer_records in printers_data.items():
            print(f"\nAnalizando impresora {printer_id} ({len(printer_records)} registros)")
            
            for i in range(1, len(printer_records)):
                current = printer_records[i]
                previous = printer_records[i-1]
                
                # Parsear raw_data
                try:
                    current_data = json.loads(current.raw_data) if current.raw_data else None
                    previous_data = json.loads(previous.raw_data) if previous.raw_data else None
                    
                    if not current_data or not previous_data:
                        continue
                    
                    # Comparar cada bandeja
                    for tray_key in current_data.get('trays', {}).keys():
                        current_available = current_data['trays'][tray_key]['available']
                        previous_available = previous_data.get('trays', {}).get(tray_key, {}).get('available', 0)
                        
                        increment = current_available - previous_available
                        
                        if increment >= MIN_INCREMENT_THRESHOLD:
                            # ¡Cambio de cartucho detectado!
                            tray_number = current_data['trays'][tray_key]['tray_number']
                            
                            print(f"  ✓ Cambio detectado en registro {current.id}: "
                                  f"{previous_available} → {current_available} (+{increment} films) en Tray{tray_number}")
                            
                            # Actualizar registro
                            update_query = text("""
                                UPDATE medical_printer_counters
                                SET cartridge_change_detected = TRUE,
                                    tray_number_changed = :tray_number,
                                    films_added = :films_added,
                                    notes = :notes
                                WHERE id = :record_id
                            """)
                            
                            db.execute(update_query, {
                                'record_id': current.id,
                                'tray_number': tray_number,
                                'films_added': increment,
                                'notes': f"Cambio de cartucho detectado en Tray{tray_number}: +{increment} films (actualizado retroactivamente)"
                            })
                            
                            updates_made += 1
                            break  # Solo detectar un cambio por registro
                
                except Exception as e:
                    print(f"  Error procesando registro {current.id}: {str(e)}")
                    continue
        
        db.commit()
        print(f"\n✅ Actualización completada: {updates_made} cambios de cartucho detectados y marcados")
        
    except Exception as e:
        print(f"❌ Error en actualización: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Iniciando actualización de registros históricos...")
    update_historical_cartridge_changes()
    print("Proceso completado")
