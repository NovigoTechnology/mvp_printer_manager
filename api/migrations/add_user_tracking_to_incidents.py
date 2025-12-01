"""
Migration: Add user tracking fields to incidents table
Date: 2025-12-01
"""
from sqlalchemy import text

def upgrade(connection):
    """Add user tracking columns to incidents table"""
    
    # Add reported_by_id column
    connection.execute(text("""
        ALTER TABLE incidents 
        ADD COLUMN IF NOT EXISTS reported_by_id INTEGER 
        REFERENCES users(id)
    """))
    
    # Add assigned_to_id column
    connection.execute(text("""
        ALTER TABLE incidents 
        ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER 
        REFERENCES users(id)
    """))
    
    # Add notes column
    connection.execute(text("""
        ALTER TABLE incidents 
        ADD COLUMN IF NOT EXISTS notes TEXT
    """))
    
    print("✅ Migration completed: User tracking fields added to incidents table")

def downgrade(connection):
    """Remove user tracking columns from incidents table"""
    
    connection.execute(text("ALTER TABLE incidents DROP COLUMN IF EXISTS reported_by_id"))
    connection.execute(text("ALTER TABLE incidents DROP COLUMN IF EXISTS assigned_to_id"))
    connection.execute(text("ALTER TABLE incidents DROP COLUMN IF EXISTS notes"))
    
    print("✅ Migration rolled back: User tracking fields removed from incidents table")

if __name__ == "__main__":
    from sqlalchemy import create_engine
    import os
    
    # Get database URL from environment
    DATABASE_URL = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/printer_fleet"
    )
    
    # Create engine and run migration
    engine = create_engine(DATABASE_URL)
    with engine.begin() as connection:
        upgrade(connection)
