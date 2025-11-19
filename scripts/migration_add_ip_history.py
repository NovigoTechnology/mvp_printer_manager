#!/usr/bin/env python3
"""
Migration: Add printer_ip_history table
Permite rastrear cambios de IP de impresoras
"""

import psycopg2
import os
from datetime import datetime

def run_migration():
    """Ejecuta la migración para agregar la tabla printer_ip_history"""
    
    # Conectar a la base de datos
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'db'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'printer_fleet'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgres')
    )
    
    cursor = conn.cursor()
    
    try:
        print("🔄 Iniciando migración: Add printer_ip_history table")
        
        # Crear tabla printer_ip_history
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS printer_ip_history (
                id SERIAL PRIMARY KEY,
                printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                old_ip VARCHAR(15),
                new_ip VARCHAR(15) NOT NULL,
                changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                changed_by VARCHAR(100) DEFAULT 'system',
                reason VARCHAR(255),
                notes TEXT
            );
        """)
        
        print("✅ Tabla printer_ip_history creada")
        
        # Crear índices para mejorar rendimiento
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_printer_ip_history_printer_id 
            ON printer_ip_history(printer_id);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_printer_ip_history_changed_at 
            ON printer_ip_history(changed_at DESC);
        """)
        
        print("✅ Índices creados")
        
        # Commit de los cambios
        conn.commit()
        
        print("✅ Migración completada exitosamente")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error durante la migración: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
