"""
Create initial admin user
"""

import sys
sys.path.append('/app')

import bcrypt
from app.db import SessionLocal
from app.models import User

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def create_admin():
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing = db.query(User).filter(User.username == 'admin').first()
        if existing:
            print("⚠️  Admin user already exists")
            return
        
        # Create admin user
        admin = User(
            username='admin',
            email='admin@printerfleet.com',
            hashed_password=hash_password('admin123'),  # CHANGE THIS PASSWORD!
            full_name='Administrador del Sistema',
            role='admin',
            is_admin=True,
            is_active=True
        )
        
        db.add(admin)
        db.commit()
        
        print("✅ Admin user created successfully!")
        print("   Username: admin")
        print("   Password: admin123")
        print("   ⚠️  IMPORTANTE: Cambia esta contraseña inmediatamente!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
