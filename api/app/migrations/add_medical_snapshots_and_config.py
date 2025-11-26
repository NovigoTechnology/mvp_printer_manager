"""
Migración: Agregar tablas de snapshots horarios y configuración de bandejas

Crea:
- medical_printer_tray_config: Configuración de capacidad por bandeja
- medical_printer_snapshots: Snapshots horarios con detección automática
- Agrega campo auto_detected a medical_printer_refills

Fecha: 2024-11-25
"""

from sqlalchemy import text
from ..db import engine

def upgrade():
    """Aplicar migración"""
    
    with engine.begin() as conn:
        # 1. Crear tabla de configuración de bandejas
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS medical_printer_tray_config (
                id SERIAL PRIMARY KEY,
                printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                tray_number INTEGER NOT NULL,
                films_per_cartridge INTEGER NOT NULL DEFAULT 100,
                cartridge_type VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT unique_printer_tray UNIQUE (printer_id, tray_number)
            )
        """))
        
        # 2. Crear tabla de snapshots horarios
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS medical_printer_snapshots (
                id SERIAL PRIMARY KEY,
                printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                tray_number INTEGER NOT NULL,
                films_available INTEGER NOT NULL,
                films_printed INTEGER NOT NULL DEFAULT 0,
                cartridge_change_detected BOOLEAN NOT NULL DEFAULT FALSE,
                auto_detected BOOLEAN NOT NULL DEFAULT FALSE,
                snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL,
                refill_id INTEGER REFERENCES medical_printer_refills(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 3. Crear índices para búsquedas rápidas
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_snapshots_printer_time 
            ON medical_printer_snapshots(printer_id, snapshot_time)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_snapshots_tray_time 
            ON medical_printer_snapshots(tray_number, snapshot_time)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_snapshots_cartridge_change 
            ON medical_printer_snapshots(cartridge_change_detected) 
            WHERE cartridge_change_detected = TRUE
        """))
        
        # 4. Agregar campo auto_detected a medical_printer_refills
        conn.execute(text("""
            ALTER TABLE medical_printer_refills 
            ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN NOT NULL DEFAULT FALSE
        """))
        
        print("✅ Migración completada: tablas de snapshots y configuración creadas")

def downgrade():
    """Revertir migración"""
    
    with engine.begin() as conn:
        # Eliminar en orden inverso por dependencias
        conn.execute(text("DROP INDEX IF EXISTS idx_snapshots_cartridge_change"))
        conn.execute(text("DROP INDEX IF EXISTS idx_snapshots_tray_time"))
        conn.execute(text("DROP INDEX IF EXISTS idx_snapshots_printer_time"))
        conn.execute(text("DROP TABLE IF EXISTS medical_printer_snapshots CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS medical_printer_tray_config CASCADE"))
        conn.execute(text("ALTER TABLE medical_printer_refills DROP COLUMN IF EXISTS auto_detected"))
        
        print("✅ Migración revertida")

if __name__ == "__main__":
    print("Aplicando migración: add_medical_snapshots_and_config")
    upgrade()
    print("Migración aplicada exitosamente")
