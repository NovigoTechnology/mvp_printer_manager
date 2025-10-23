#!/usr/bin/env python3
"""
Migration script to create toner_requests table
Run this script to create the new toner requests table
"""

from sqlalchemy import create_engine, text
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import DATABASE_URL

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    # SQL command to create toner_requests table
    create_table_command = """
    CREATE TABLE IF NOT EXISTS toner_requests (
        id SERIAL PRIMARY KEY,
        printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
        
        -- Información del pedido
        request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR DEFAULT 'pending',
        priority VARCHAR DEFAULT 'normal',
        
        -- Tóners solicitados
        toner_black_requested BOOLEAN DEFAULT FALSE,
        toner_cyan_requested BOOLEAN DEFAULT FALSE,
        toner_magenta_requested BOOLEAN DEFAULT FALSE,
        toner_yellow_requested BOOLEAN DEFAULT FALSE,
        
        -- Códigos específicos
        toner_black_code VARCHAR,
        toner_cyan_code VARCHAR,
        toner_magenta_code VARCHAR,
        toner_yellow_code VARCHAR,
        
        -- Información adicional
        other_supplies_requested TEXT,
        justification TEXT,
        notes TEXT,
        
        -- Información del solicitante
        requested_by VARCHAR NOT NULL,
        department VARCHAR,
        cost_center VARCHAR,
        
        -- Fechas de seguimiento
        approved_date TIMESTAMP WITH TIME ZONE,
        ordered_date TIMESTAMP WITH TIME ZONE,
        delivered_date TIMESTAMP WITH TIME ZONE,
        cancelled_date TIMESTAMP WITH TIME ZONE,
        
        -- Aprobación
        approved_by VARCHAR,
        rejection_reason TEXT,
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    );
    """
    
    # Create indexes for better performance
    create_indexes_commands = [
        "CREATE INDEX IF NOT EXISTS idx_toner_requests_printer_id ON toner_requests(printer_id);",
        "CREATE INDEX IF NOT EXISTS idx_toner_requests_status ON toner_requests(status);",
        "CREATE INDEX IF NOT EXISTS idx_toner_requests_request_date ON toner_requests(request_date DESC);",
        "CREATE INDEX IF NOT EXISTS idx_toner_requests_requested_by ON toner_requests(requested_by);",
    ]
    
    try:
        with engine.connect() as connection:
            # Begin transaction
            trans = connection.begin()
            
            try:
                # Create table
                print("Creating toner_requests table...")
                connection.execute(text(create_table_command))
                
                # Create indexes
                for idx_command in create_indexes_commands:
                    print(f"Creating index: {idx_command.split('ON')[0].split('IF NOT EXISTS')[1].strip()}")
                    connection.execute(text(idx_command))
                
                # Commit transaction
                trans.commit()
                print("✅ Migration completed successfully!")
                print("Created toner_requests table with:")
                print("  - Full audit trail (created_at, updated_at)")
                print("  - Foreign key relationship to printers table")
                print("  - Individual toner selection fields")
                print("  - Status tracking (pending, approved, ordered, delivered, cancelled)")
                print("  - Priority levels (low, normal, high, urgent)")
                print("  - Request approval workflow")
                print("  - Performance indexes on key fields")
                
            except Exception as e:
                # Rollback on error
                trans.rollback()
                print(f"❌ Migration failed: {e}")
                raise
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🔧 Starting toner_requests table migration...")
    success = run_migration()
    if success:
        print("🎉 Migration completed! The toner requests system is now ready.")
    else:
        print("💥 Migration failed. Please check the error messages above.")
        sys.exit(1)