"""
Migration: Add SMTP Configuration table
"""

import sys
sys.path.append('/app')

from sqlalchemy import text, create_engine, Column, Integer, String, Boolean, DateTime
from app.config import settings

def run_migration():
    """Add SMTP configuration table"""
    
    database_url = settings.database_url
    engine = create_engine(database_url)
    
    with engine.begin() as connection:
        # Check if table already exists
        result = connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'smtp_config'
            )
        """))
        
        if result.scalar():
            print("✅ SMTP config table already exists")
            return
        
        # Create SMTP config table
        connection.execute(text("""
            CREATE TABLE smtp_config (
                id SERIAL PRIMARY KEY,
                enabled BOOLEAN DEFAULT FALSE,
                host VARCHAR(255),
                port INTEGER DEFAULT 587,
                use_tls BOOLEAN DEFAULT TRUE,
                username VARCHAR(255),
                password VARCHAR(512),
                from_email VARCHAR(255),
                from_name VARCHAR(255) DEFAULT 'Printer Fleet Manager',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_by VARCHAR(255),
                CONSTRAINT unique_smtp_config UNIQUE (id)
            )
        """))
        
        # Create index for faster lookups
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_smtp_enabled ON smtp_config(enabled)
        """))
        
        # Insert default (disabled) configuration
        connection.execute(text("""
            INSERT INTO smtp_config (id, enabled, host, port, use_tls, from_name)
            VALUES (1, FALSE, '', 587, TRUE, 'Printer Fleet Manager')
            ON CONFLICT (id) DO NOTHING
        """))
        
        print("✅ SMTP config table created successfully")

if __name__ == "__main__":
    try:
        run_migration()
        print("Migration completed successfully!")
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        sys.exit(1)
