"""
Create counter_schedule_executions table for tracking execution history
"""

from sqlalchemy import text
from ..db import engine

def migrate():
    """Run the migration"""
    with engine.connect() as connection:
        # Create counter_schedule_executions table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS counter_schedule_executions (
                id SERIAL PRIMARY KEY,
                schedule_id INTEGER NOT NULL REFERENCES counter_schedules(id) ON DELETE CASCADE,
                execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                success BOOLEAN NOT NULL,
                error_message TEXT,
                printers_processed INTEGER DEFAULT 0,
                printers_successful INTEGER DEFAULT 0,
                printers_failed INTEGER DEFAULT 0,
                total_reports_created INTEGER DEFAULT 0,
                execution_duration_seconds FLOAT,
                retry_count INTEGER DEFAULT 0,
                details TEXT
            );
        """))
        
        # Create index for faster queries
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_counter_schedule_executions_schedule_id 
            ON counter_schedule_executions(schedule_id);
        """))
        
        # Create index for execution time for ordering
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_counter_schedule_executions_execution_time 
            ON counter_schedule_executions(execution_time DESC);
        """))
        
        connection.commit()
        print("✅ Created counter_schedule_executions table with indexes")

if __name__ == "__main__":
    migrate()