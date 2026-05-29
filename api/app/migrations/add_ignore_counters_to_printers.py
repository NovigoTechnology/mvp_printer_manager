"""
Migration: Add ignore_counters flag to printers table
Date: 2026-05-29
Description: Adds ignore_counters column to allow excluding specific printers from automatic counter collection
"""

from sqlalchemy import create_engine, text
import os


def run_migration():
    """Run migration to add ignore_counters column in printers table."""

    # Database connection parameters
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
                ALTER TABLE printers
                ADD COLUMN IF NOT EXISTS ignore_counters BOOLEAN DEFAULT FALSE NOT NULL
            """))

            conn.execute(text("""
                UPDATE printers
                SET ignore_counters = FALSE
                WHERE ignore_counters IS NULL
            """))

            conn.commit()

        print("Migration completed: ignore_counters added to printers table")

    except Exception as e:
        print(f"Error running migration: {e}")
        raise


if __name__ == "__main__":
    run_migration()
