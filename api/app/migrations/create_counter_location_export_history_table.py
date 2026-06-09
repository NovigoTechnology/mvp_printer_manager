"""
Create counter_location_export_history table for tracking exports
of monthly counters by location.
"""

from sqlalchemy import create_engine, text
import os


def run_migration():
    """Run migration for counter location export history table."""

    DB_HOST = os.getenv('DB_HOST', 'db')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'printer_fleet')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

    database_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    try:
        engine = create_engine(database_url)

        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS counter_location_export_history (
                    id SERIAL PRIMARY KEY,
                    exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    year INTEGER,
                    month INTEGER,
                    total_locations INTEGER DEFAULT 0,
                    total_pages INTEGER DEFAULT 0,
                    filename VARCHAR(255),
                    requested_by VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'success',
                    error_message TEXT,
                    filters TEXT
                )
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_counter_location_export_history_exported_at
                ON counter_location_export_history(exported_at DESC)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_counter_location_export_history_period
                ON counter_location_export_history(year, month)
            """))

            conn.commit()

        print("Migration completed: counter_location_export_history table created")

    except Exception as e:
        print(f"Error running migration: {e}")
        raise


if __name__ == "__main__":
    run_migration()
