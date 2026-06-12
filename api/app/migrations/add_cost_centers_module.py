"""
Migration: add cost centers normalized module tables.
Date: 2026-06-12
"""

import os
from sqlalchemy import create_engine, text


def run_migration():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        db_host = os.getenv("DB_HOST", "db")
        db_port = os.getenv("DB_PORT", "5432")
        db_name = os.getenv("DB_NAME", "printer_fleet")
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("DB_PASSWORD", "postgres")
        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    engine = create_engine(database_url)

    with engine.connect() as conn:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS branches (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(20) NOT NULL UNIQUE,
                    name VARCHAR(120) NOT NULL UNIQUE,
                    address TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS departments (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(20) NOT NULL UNIQUE,
                    name VARCHAR(120) NOT NULL UNIQUE,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS areas (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(20) NOT NULL UNIQUE,
                    name VARCHAR(120) NOT NULL UNIQUE,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS organizational_units (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    branch_id INTEGER NOT NULL REFERENCES branches(id),
                    department_id INTEGER NOT NULL REFERENCES departments(id),
                    area_id INTEGER NOT NULL REFERENCES areas(id),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT uq_organizational_unit_tuple UNIQUE (company_id, branch_id, department_id, area_id)
                )
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS cost_centers (
                    id SERIAL PRIMARY KEY,
                    organizational_unit_id INTEGER NOT NULL REFERENCES organizational_units(id),
                    sequence_number INTEGER NOT NULL,
                    code VARCHAR(120) NOT NULL UNIQUE,
                    name VARCHAR(160),
                    description TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT uq_cost_center_org_sequence UNIQUE (organizational_unit_id, sequence_number)
                )
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS cost_center_audits (
                    id SERIAL PRIMARY KEY,
                    cost_center_id INTEGER NOT NULL REFERENCES cost_centers(id),
                    action VARCHAR(20) NOT NULL,
                    changed_by VARCHAR(100),
                    change_reason TEXT,
                    changed_fields TEXT,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_organizational_units_company_branch
                ON organizational_units(company_id, branch_id)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_cost_centers_org_unit
                ON cost_centers(organizational_unit_id)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_cost_centers_status
                ON cost_centers(status)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_cost_center_audits_center_time
                ON cost_center_audits(cost_center_id, created_at DESC)
            """))

            conn.execute(text("""
                ALTER TABLE lease_contracts
                ADD COLUMN IF NOT EXISTS cost_center_id INTEGER
            """))

            conn.execute(text("""
                ALTER TABLE printers
                ADD COLUMN IF NOT EXISTS cost_center_id INTEGER
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_lease_contracts_cost_center_id
                ON lease_contracts(cost_center_id)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_printers_cost_center_id
                ON printers(cost_center_id)
            """))

            conn.commit()
            print("Migration completed: cost centers module tables created")
        except Exception as exc:
            conn.rollback()
            print(f"Migration failed: {exc}")
            raise


if __name__ == "__main__":
    run_migration()
