"""
Migración: Agregar campos de detección de cambio de cartucho a medical_printer_counters

Agrega:
- cartridge_change_detected: Indica si se detectó cambio de cartucho en este snapshot
- tray_number_changed: Número de bandeja donde se detectó el cambio
- films_added: Cantidad de films agregados en el cambio

Fecha: 2024-11-26
"""

from sqlalchemy import text
from ..db import engine

def upgrade():
    """Aplicar migración"""
    
    with engine.begin() as conn:
        # Agregar campos de detección de cambio de cartucho
        conn.execute(text("""
            ALTER TABLE medical_printer_counters 
            ADD COLUMN IF NOT EXISTS cartridge_change_detected BOOLEAN DEFAULT FALSE
        """))
        
        conn.execute(text("""
            ALTER TABLE medical_printer_counters 
            ADD COLUMN IF NOT EXISTS tray_number_changed INTEGER
        """))
        
        conn.execute(text("""
            ALTER TABLE medical_printer_counters 
            ADD COLUMN IF NOT EXISTS films_added INTEGER DEFAULT 0
        """))
        
        print("✅ Migración completada: campos de cambio de cartucho agregados a medical_printer_counters")

def downgrade():
    """Revertir migración"""
    
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE medical_printer_counters DROP COLUMN IF EXISTS cartridge_change_detected"))
        conn.execute(text("ALTER TABLE medical_printer_counters DROP COLUMN IF EXISTS tray_number_changed"))
        conn.execute(text("ALTER TABLE medical_printer_counters DROP COLUMN IF EXISTS films_added"))
        
        print("✅ Migración revertida")

if __name__ == "__main__":
    print("Aplicando migración: add_cartridge_change_fields_to_counters")
    upgrade()
    print("Migración aplicada exitosamente")
