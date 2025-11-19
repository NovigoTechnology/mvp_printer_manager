"""
Migration: Add companies and contract_companies tables
Date: 2025-11-09
Description: Creates companies table and contract_companies many-to-many relationship table
"""

from sqlalchemy import create_engine, text
import os

def run_migration():
    """Run the migration to add companies and contract_companies tables"""
    
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
            print("Creating companies table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    legal_name VARCHAR(255),
                    tax_id VARCHAR(50) UNIQUE NOT NULL,
                    business_type VARCHAR(100),
                    address TEXT,
                    city VARCHAR(100),
                    state VARCHAR(100),
                    postal_code VARCHAR(20),
                    country VARCHAR(100) DEFAULT 'Argentina',
                    contact_person VARCHAR(255),
                    contact_position VARCHAR(100),
                    phone VARCHAR(50),
                    mobile VARCHAR(50),
                    email VARCHAR(255),
                    website VARCHAR(255),
                    industry VARCHAR(100),
                    size VARCHAR(50) DEFAULT 'medium',
                    annual_revenue FLOAT,
                    employee_count INTEGER,
                    status VARCHAR(20) DEFAULT 'active',
                    priority VARCHAR(20) DEFAULT 'medium',
                    credit_rating VARCHAR(20),
                    payment_terms VARCHAR(100) DEFAULT '30 days',
                    notes TEXT,
                    internal_notes TEXT,
                    tags TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            
            print("Creating indexes for companies table...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_companies_name ON companies(name);
                CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_tax_id ON companies(tax_id);
            """))
            
            print("Creating contract_companies table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS contract_companies (
                    id SERIAL PRIMARY KEY,
                    contract_id INTEGER NOT NULL REFERENCES lease_contracts(id),
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    role VARCHAR(50) DEFAULT 'client',
                    participation_percentage FLOAT DEFAULT 100.0,
                    is_primary BOOLEAN DEFAULT FALSE,
                    start_date TIMESTAMP WITH TIME ZONE,
                    end_date TIMESTAMP WITH TIME ZONE,
                    is_active BOOLEAN DEFAULT TRUE,
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT unique_contract_company UNIQUE(contract_id, company_id)
                )
            """))
            
            # Commit changes
            conn.commit()
            
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error running migration: {e}")
        raise

if __name__ == "__main__":
    run_migration()