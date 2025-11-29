"""
Migration: Enhance users table with roles and permissions
Adds: full_name, department, phone, role, permissions, last_login
"""

import sys
sys.path.append('/app')

from app.db import SessionLocal
from sqlalchemy import text

def run_migration():
    db = SessionLocal()
    
    try:
        print("🔄 Enhancing users table...")
        
        # Add new columns
        migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'viewer'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE",
        ]
        
        for migration_sql in migrations:
            try:
                db.execute(text(migration_sql))
                print(f"✅ Executed: {migration_sql[:50]}...")
            except Exception as e:
                print(f"⚠️  Column might already exist: {str(e)[:100]}")
        
        db.commit()
        
        # Update existing users to have viewer role if not set
        db.execute(text("UPDATE users SET role = 'viewer' WHERE role IS NULL"))
        
        # Set admin role for admin users
        db.execute(text("UPDATE users SET role = 'admin' WHERE is_admin = true"))
        
        db.commit()
        
        print("✅ Users table enhanced successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
