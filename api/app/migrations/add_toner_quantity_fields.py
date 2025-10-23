#!/usr/bin/env python3
"""
Migration script to add quantity fields to toner_requests table
Run this script to add toner quantity tracking columns
"""

from sqlalchemy import create_engine, text
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import DATABASE_URL

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    # SQL commands to add new quantity columns
    column_commands = [
        "ALTER TABLE toner_requests ADD COLUMN IF NOT EXISTS toner_black_quantity INTEGER DEFAULT 1;",
        "ALTER TABLE toner_requests ADD COLUMN IF NOT EXISTS toner_cyan_quantity INTEGER DEFAULT 1;",
        "ALTER TABLE toner_requests ADD COLUMN IF NOT EXISTS toner_magenta_quantity INTEGER DEFAULT 1;",
        "ALTER TABLE toner_requests ADD COLUMN IF NOT EXISTS toner_yellow_quantity INTEGER DEFAULT 1;",
    ]
    
    # Update commands (safe to run multiple times)
    update_commands = [
        "UPDATE toner_requests SET toner_black_quantity = 1 WHERE toner_black_quantity IS NULL;",
        "UPDATE toner_requests SET toner_cyan_quantity = 1 WHERE toner_cyan_quantity IS NULL;",
        "UPDATE toner_requests SET toner_magenta_quantity = 1 WHERE toner_magenta_quantity IS NULL;",
        "UPDATE toner_requests SET toner_yellow_quantity = 1 WHERE toner_yellow_quantity IS NULL;",
    ]
    
    # Constraint commands (may fail if already exist, but that's ok)
    constraint_commands = [
        "ALTER TABLE toner_requests ADD CONSTRAINT check_toner_black_quantity_positive CHECK (toner_black_quantity > 0);",
        "ALTER TABLE toner_requests ADD CONSTRAINT check_toner_cyan_quantity_positive CHECK (toner_cyan_quantity > 0);",
        "ALTER TABLE toner_requests ADD CONSTRAINT check_toner_magenta_quantity_positive CHECK (toner_magenta_quantity > 0);",
        "ALTER TABLE toner_requests ADD CONSTRAINT check_toner_yellow_quantity_positive CHECK (toner_yellow_quantity > 0);",
    ]
    
    try:
        with engine.connect() as connection:
            # Begin transaction
            trans = connection.begin()
            
            try:
                # Execute column additions (safe)
                for command in column_commands:
                    print(f"Executing: {command}")
                    connection.execute(text(command))
                
                # Execute updates (safe)
                for command in update_commands:
                    print(f"Executing: {command}")
                    connection.execute(text(command))
                
                # Execute constraints (may fail if they already exist)
                for command in constraint_commands:
                    try:
                        print(f"Executing: {command}")
                        connection.execute(text(command))
                    except Exception as e:
                        print(f"⚠️  Constraint may already exist (this is OK): {e}")
                
                # Commit transaction
                trans.commit()
                print("✅ Migration completed successfully!")
                print("Added quantity tracking columns to toner_requests table:")
                print("  - toner_black_quantity (INTEGER, DEFAULT 1)")
                print("  - toner_cyan_quantity (INTEGER, DEFAULT 1)")
                print("  - toner_magenta_quantity (INTEGER, DEFAULT 1)")
                print("  - toner_yellow_quantity (INTEGER, DEFAULT 1)")
                print("  - Added positive value constraints (if not already present)")
                print("  - Updated existing records with default quantity 1")
                
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
    print("🔧 Starting toner quantity fields migration...")
    success = run_migration()
    if success:
        print("🎉 Migration completed! Toner quantity tracking is now available.")
    else:
        print("💥 Migration failed. Please check the error messages above.")
        sys.exit(1)