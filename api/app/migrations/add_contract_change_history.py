"""
Create contract change history table.
"""

from sqlalchemy import text

from app.db import engine


def run_migration():
    with engine.connect() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS contract_change_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contract_id INTEGER NOT NULL,
                action VARCHAR(30) NOT NULL,
                changed_by_id INTEGER,
                changed_by_name VARCHAR(150),
                change_note TEXT NOT NULL,
                changed_fields TEXT,
                previous_values TEXT,
                new_values TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(contract_id) REFERENCES lease_contracts(id),
                FOREIGN KEY(changed_by_id) REFERENCES users(id)
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_contract_change_history_contract_time
            ON contract_change_history(contract_id, created_at DESC)
        """))
        connection.commit()


if __name__ == "__main__":
    run_migration()
    print("Migration completed: contract_change_history table created")