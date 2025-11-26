"""
Migration: Create medical_printer_counters table

Description: Creates table to store daily snapshots of medical printer counters (DRYPIX)
             for historical tracking and analytics.

Author: System
Date: 2025-11-22
"""

from sqlalchemy import create_engine, text
import os

def run_migration():
    """Run the migration to create medical_printer_counters table"""
    
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/printer_fleet")
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        try:
            print("Creating medical_printer_counters table...")
            
            # Create the table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS medical_printer_counters (
                    id SERIAL PRIMARY KEY,
                    printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    
                    -- Summary data for quick queries
                    total_printed INTEGER DEFAULT 0,
                    total_available INTEGER DEFAULT 0,
                    total_trays_loaded INTEGER DEFAULT 0,
                    is_online BOOLEAN DEFAULT TRUE,
                    
                    -- Complete data in JSON format
                    raw_data TEXT,
                    
                    -- Metadata
                    collection_method VARCHAR(20) DEFAULT 'automatic',
                    notes TEXT
                );
            """))
            conn.commit()
            
            print("✅ Created medical_printer_counters table")
            
            # Create indexes for efficient queries
            print("Creating indexes...")
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_printer_counters_printer_id 
                ON medical_printer_counters(printer_id);
            """))
            conn.commit()
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_printer_counters_timestamp 
                ON medical_printer_counters(timestamp DESC);
            """))
            conn.commit()
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_printer_counters_printer_timestamp 
                ON medical_printer_counters(printer_id, timestamp DESC);
            """))
            conn.commit()
            
            print("✅ Created indexes on medical_printer_counters table")
            
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    run_migration()
