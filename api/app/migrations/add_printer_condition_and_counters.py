"""
Migration: Add equipment_condition and initial counters to printers table
Date: 2024-10-24
Description: Adds equipment_condition field (new/used) and initial counter fields for used equipment
"""

from sqlalchemy import create_engine, text
import os
from datetime import datetime

def run_migration():
    """Run the migration to add equipment_condition and initial counter fields"""
    
    # Database connection parameters
    DB_HOST = os.getenv('DB_HOST', 'db')  # 'db' is the service name in docker-compose
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'printer_fleet')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
    
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    try:
        # Create database engine
        engine = create_engine(DATABASE_URL)
        
        print("Connected to database successfully")
        
        with engine.connect() as conn:
            # Add equipment_condition column
            print("Adding equipment_condition column...")
            conn.execute(text("""
                ALTER TABLE printers 
                ADD COLUMN IF NOT EXISTS equipment_condition VARCHAR DEFAULT 'new' NOT NULL
            """))
            
            # Add initial counter columns
            print("Adding initial counter columns...")
            conn.execute(text("""
                ALTER TABLE printers 
                ADD COLUMN IF NOT EXISTS initial_counter_bw INTEGER DEFAULT 0
            """))
            
            conn.execute(text("""
                ALTER TABLE printers 
                ADD COLUMN IF NOT EXISTS initial_counter_color INTEGER DEFAULT 0
            """))
            
            conn.execute(text("""
                ALTER TABLE printers 
                ADD COLUMN IF NOT EXISTS initial_counter_total INTEGER DEFAULT 0
            """))
            
            # Update existing printers to have 'new' as default equipment_condition
            print("Setting default equipment_condition for existing printers...")
            conn.execute(text("""
                UPDATE printers 
                SET equipment_condition = 'new' 
                WHERE equipment_condition IS NULL
            """))
            
            # Commit changes
            conn.commit()
            
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error running migration: {e}")
        raise

if __name__ == "__main__":
    run_migration()