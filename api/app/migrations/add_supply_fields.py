#!/usr/bin/env python3
"""
Migration script to add supply fields to printer table
Run this script to add the new supply tracking columns safely
"""

from sqlalchemy import create_engine, text
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import DATABASE_URL

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    # SQL commands to add new columns
    migration_commands = [
        "ALTER TABLE printers ADD COLUMN IF NOT EXISTS toner_black_code VARCHAR;",
        "ALTER TABLE printers ADD COLUMN IF NOT EXISTS toner_cyan_code VARCHAR;", 
        "ALTER TABLE printers ADD COLUMN IF NOT EXISTS toner_magenta_code VARCHAR;",
        "ALTER TABLE printers ADD COLUMN IF NOT EXISTS toner_yellow_code VARCHAR;",
        "ALTER TABLE printers ADD COLUMN IF NOT EXISTS other_supplies TEXT;",
    ]
    
    try:
        with engine.connect() as connection:
            # Begin transaction
            trans = connection.begin()
            
            try:
                for command in migration_commands:
                    print(f"Executing: {command}")
                    connection.execute(text(command))
                
                # Commit transaction
                trans.commit()
                print("✅ Migration completed successfully!")
                print("New supply tracking columns added to printers table:")
                print("  - toner_black_code")
                print("  - toner_cyan_code") 
                print("  - toner_magenta_code")
                print("  - toner_yellow_code")
                print("  - other_supplies")
                
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
    print("🔧 Starting supply fields migration...")
    success = run_migration()
    if success:
        print("🎉 Migration completed! You can now restart the application.")
    else:
        print("💥 Migration failed. Please check the error messages above.")
        sys.exit(1)