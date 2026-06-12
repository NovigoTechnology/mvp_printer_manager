"""
Migration: add manual medical flag and medical counter alerts tables.
Date: 2026-06-12
"""

from sqlalchemy import create_engine, text
import os


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
                ALTER TABLE printers
                ADD COLUMN IF NOT EXISTS is_medical BOOLEAN NOT NULL DEFAULT FALSE
            """))

            conn.execute(text("""
                UPDATE printers
                SET is_medical = TRUE
                WHERE
                    UPPER(COALESCE(model, '')) LIKE '%DRYPIX%'
                    OR UPPER(COALESCE(model, '')) LIKE '%FCR%'
                    OR UPPER(COALESCE(model, '')) LIKE '%DI-HL%'
                    OR UPPER(COALESCE(model, '')) = 'CR'
                    OR LOWER(COALESCE(print_technology, '')) = 'dicom'
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS medical_counter_alerts (
                    id SERIAL PRIMARY KEY,
                    printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL DEFAULT 'open',
                    total_errors INTEGER NOT NULL DEFAULT 0,
                    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    last_error_message TEXT,
                    last_task_name VARCHAR(100),
                    resolved_at TIMESTAMP WITH TIME ZONE,
                    resolved_by VARCHAR(100),
                    resolved_notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))

            conn.execute(text("""
                ALTER TABLE medical_counter_alerts
                ADD COLUMN IF NOT EXISTS resolved_notes TEXT
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_counter_alerts_status_last_seen
                ON medical_counter_alerts(status, last_seen_at DESC)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_counter_alerts_printer
                ON medical_counter_alerts(printer_id)
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS medical_counter_alert_events (
                    id SERIAL PRIMARY KEY,
                    alert_id INTEGER NOT NULL REFERENCES medical_counter_alerts(id) ON DELETE CASCADE,
                    printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
                    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    task_name VARCHAR(100) NOT NULL,
                    error_message TEXT NOT NULL,
                    run_context VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_counter_alert_events_alert_time
                ON medical_counter_alert_events(alert_id, occurred_at DESC)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_medical_counter_alert_events_printer_time
                ON medical_counter_alert_events(printer_id, occurred_at DESC)
            """))

            conn.commit()
            print("Migration completed: medical alert tables and is_medical field created")

        except Exception as exc:
            conn.rollback()
            print(f"Migration failed: {exc}")
            raise


if __name__ == "__main__":
    run_migration()
