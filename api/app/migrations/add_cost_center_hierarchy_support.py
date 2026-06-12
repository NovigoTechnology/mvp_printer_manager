"""
Migration: enable hierarchical cost centers (company/branch/department/area).
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
                ALTER TABLE organizational_units
                ALTER COLUMN branch_id DROP NOT NULL,
                ALTER COLUMN department_id DROP NOT NULL,
                ALTER COLUMN area_id DROP NOT NULL
            """))

            conn.execute(text("""
                ALTER TABLE cost_centers
                ADD COLUMN IF NOT EXISTS parent_cost_center_id INTEGER
            """))

            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_cost_centers_parent_cost_center_id'
                    ) THEN
                        ALTER TABLE cost_centers
                        ADD CONSTRAINT fk_cost_centers_parent_cost_center_id
                        FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(id)
                        ON DELETE SET NULL;
                    END IF;
                END
                $$
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_cost_centers_parent_cost_center_id
                ON cost_centers(parent_cost_center_id)
            """))

            conn.commit()
            print("Migration completed: hierarchical cost center support enabled")
        except Exception as exc:
            conn.rollback()
            print(f"Migration failed: {exc}")
            raise


if __name__ == "__main__":
    run_migration()
