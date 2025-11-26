"""
Migración: Crear tabla medical_printer_refills
Descripción: Tabla para registrar recargas de cartuchos en impresoras médicas
"""

from sqlalchemy import create_engine, text
import os

def migrate():
    """Ejecutar la migración"""
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/printer_fleet")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        try:
            print("Creando tabla medical_printer_refills...")
            
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS medical_printer_refills (
                    id SERIAL PRIMARY KEY,
                    printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                    refill_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    
                    -- Información del cartucho
                    tray_name VARCHAR(50) NOT NULL,
                    cartridge_quantity INTEGER DEFAULT 1,
                    plates_per_cartridge INTEGER DEFAULT 100,
                    total_plates_added INTEGER NOT NULL,
                    
                    -- Contadores antes de la recarga
                    counter_before_refill INTEGER DEFAULT 0,
                    available_before_refill INTEGER DEFAULT 0,
                    
                    -- Contadores después de la recarga
                    counter_after_refill INTEGER,
                    available_after_refill INTEGER,
                    
                    -- Relación con pedidos/incidentes
                    incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
                    toner_request_id INTEGER REFERENCES toner_requests(id) ON DELETE SET NULL,
                    
                    -- Información adicional
                    batch_number VARCHAR(100),
                    expiry_date TIMESTAMP WITH TIME ZONE,
                    supplier VARCHAR(200),
                    cost DOUBLE PRECISION DEFAULT 0.0,
                    
                    -- Usuario y notas
                    loaded_by VARCHAR(100),
                    notes TEXT
                );
            """))
            conn.commit()
            
            print("Creando índices...")
            
            # Índice por impresora
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_printer_refills_printer_id 
                ON medical_printer_refills(printer_id);
            """))
            conn.commit()
            
            # Índice por fecha
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_printer_refills_refill_date 
                ON medical_printer_refills(refill_date DESC);
            """))
            conn.commit()
            
            # Índice compuesto para consultas por impresora y fecha
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_printer_refills_printer_date 
                ON medical_printer_refills(printer_id, refill_date DESC);
            """))
            conn.commit()
            
            print("✅ Tabla medical_printer_refills creada exitosamente")
            
        except Exception as e:
            print(f"❌ Error durante la migración: {str(e)}")
            raise

if __name__ == "__main__":
    migrate()
