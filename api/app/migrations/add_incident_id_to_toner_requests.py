"""
Migration: Add incident_id to toner_requests table
Date: 2024-10-25
Description: Adds incident_id foreign key to link toner requests with incidents
"""

from sqlalchemy import create_engine, text
import os

def run_migration():
    """Run the migration to add incident_id to toner_requests table"""
    
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
            # Add incident_id column
            print("Adding incident_id column to toner_requests table...")
            conn.execute(text("""
                ALTER TABLE toner_requests 
                ADD COLUMN IF NOT EXISTS incident_id INTEGER REFERENCES incidents(id)
            """))
            
            # Commit changes
            conn.commit()
            
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error running migration: {e}")
        raise

if __name__ == "__main__":
    run_migration()