"""
Migration: Add location_snapshot to counter tables
Date: 2026-05-29
Description: Stores printer location at reading time so historical volume per location remains stable after printer moves.
"""

from sqlalchemy import create_engine, text
import os


def run_migration():
    """Run migration to add location_snapshot columns and backfill existing records."""

    DB_HOST = os.getenv("DB_HOST", "db")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "printer_fleet")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

    database_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    try:
        engine = create_engine(database_url)

        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE monthly_counters
                ADD COLUMN IF NOT EXISTS location_snapshot VARCHAR
            """))

            conn.execute(text("""
                ALTER TABLE counter_readings
                ADD COLUMN IF NOT EXISTS location_snapshot VARCHAR
            """))

            # Backfill existing rows using printer current location as baseline.
            conn.execute(text("""
                UPDATE monthly_counters mc
                SET location_snapshot = p.location
                FROM printers p
                WHERE mc.printer_id = p.id
                  AND mc.location_snapshot IS NULL
            """))

            conn.execute(text("""
                UPDATE counter_readings cr
                SET location_snapshot = p.location
                FROM printers p
                WHERE cr.printer_id = p.id
                  AND cr.location_snapshot IS NULL
            """))

            conn.commit()

        print("Migration completed: location_snapshot added to monthly_counters and counter_readings")

    except Exception as e:
        print(f"Error running migration: {e}")
        raise


if __name__ == "__main__":
    run_migration()
