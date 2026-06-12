"""
Migration: Add cost_center_id foreign keys to lease_contracts and printers
Date: 2026-06-12
Description: Adds relational cost center linkage for contracts and printers while keeping legacy text code fields.
"""

from sqlalchemy import create_engine, text
import os


def run_migration():
    """Run migration to add cost_center_id references in contracts and printers."""

    DB_HOST = os.getenv('DB_HOST', 'db')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'printer_fleet')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    try:
        engine = create_engine(DATABASE_URL)

        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE lease_contracts
                ADD COLUMN IF NOT EXISTS cost_center_id INTEGER
            """))

            conn.execute(text("""
                ALTER TABLE printers
                ADD COLUMN IF NOT EXISTS cost_center_id INTEGER
            """))

            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_lease_contracts_cost_center_id'
                    ) THEN
                        ALTER TABLE lease_contracts
                        ADD CONSTRAINT fk_lease_contracts_cost_center_id
                        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
                        ON DELETE SET NULL;
                    END IF;
                END
                $$
            """))

            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_printers_cost_center_id'
                    ) THEN
                        ALTER TABLE printers
                        ADD CONSTRAINT fk_printers_cost_center_id
                        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
                        ON DELETE SET NULL;
                    END IF;
                END
                $$
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

        print("Migration completed: cost_center_id references added to lease_contracts and printers")

    except Exception as e:
        print(f"Error running migration: {e}")
        raise


if __name__ == "__main__":
    run_migration()
