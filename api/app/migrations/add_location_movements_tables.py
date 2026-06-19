"""
Migration: Add Location Movements and Counter Segments tables
"""

import sys
sys.path.append('/app')

from sqlalchemy import text, create_engine
from app.config import settings

def run_migration():
    """Add printer_movements and location_counter_segments tables"""

    database_url = settings.database_url
    engine = create_engine(database_url)

    with engine.begin() as connection:
        # Check if printer_movements table already exists
        result = connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'printer_movements'
            )
        """))

        if result.scalar():
            print("✅ printer_movements table already exists")
        else:
            # Create printer_movements table
            connection.execute(text("""
                CREATE TABLE printer_movements (
                    id SERIAL PRIMARY KEY,
                    printer_id INTEGER NOT NULL REFERENCES printers(id),
                    location_from VARCHAR(255) DEFAULT 'Descubierto automaticamente',
                    location_to VARCHAR(255) DEFAULT 'Descubierto automaticamente' NOT NULL,
                    movement_date TIMESTAMP WITH TIME ZONE NOT NULL,
                    movement_reason VARCHAR(255),
                    snapshot_status VARCHAR(50) DEFAULT 'pending',
                    snapshot_counter_bw INTEGER,
                    snapshot_counter_color INTEGER,
                    snapshot_counter_total INTEGER,
                    snapshot_attempt_at TIMESTAMP WITH TIME ZONE,
                    snapshot_success BOOLEAN DEFAULT FALSE,
                    fallback_source VARCHAR(50),
                    created_by VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # Create indexes for printer_movements
            connection.execute(text("""
                CREATE INDEX ix_printer_movements_printer_date
                ON printer_movements(printer_id, movement_date)
            """))

            print("✅ printer_movements table created")

        # Check if location_counter_segments table already exists
        result = connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'location_counter_segments'
            )
        """))

        if result.scalar():
            print("✅ location_counter_segments table already exists")
        else:
            # Create location_counter_segments table
            connection.execute(text("""
                CREATE TABLE location_counter_segments (
                    id SERIAL PRIMARY KEY,
                    printer_id INTEGER NOT NULL REFERENCES printers(id),
                    location VARCHAR(255) DEFAULT 'Descubierto automaticamente' NOT NULL,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    segment_start_date INTEGER NOT NULL,
                    segment_end_date INTEGER NOT NULL,
                    counter_bw_start INTEGER,
                    counter_bw_end INTEGER,
                    counter_color_start INTEGER,
                    counter_color_end INTEGER,
                    counter_total_start INTEGER,
                    counter_total_end INTEGER,
                    pages_bw INTEGER DEFAULT 0,
                    pages_color INTEGER DEFAULT 0,
                    pages_total INTEGER DEFAULT 0,
                    data_quality VARCHAR(50) DEFAULT 'partial',
                    movement_id INTEGER REFERENCES printer_movements(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # Create indexes for location_counter_segments
            connection.execute(text("""
                CREATE INDEX ix_location_segments_printer_month
                ON location_counter_segments(printer_id, year, month)
            """))

            connection.execute(text("""
                CREATE INDEX ix_location_segments_location
                ON location_counter_segments(location, year, month)
            """))

            # Create unique constraint
            connection.execute(text("""
                ALTER TABLE location_counter_segments
                ADD CONSTRAINT uq_segment
                UNIQUE (printer_id, location, year, month, segment_start_date, segment_end_date)
            """))

            print("✅ location_counter_segments table created")

if __name__ == "__main__":
    run_migration()
