"""
Add deployment-aware billing targets, invoice metadata and automation tables.
"""

from sqlalchemy import create_engine, inspect, text
import sys

sys.path.append('/app')

from app.config import settings


def _has_table(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    if not _has_table(inspector, table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _add_column_if_missing(connection, inspector, table_name: str, column_sql: str):
    column_name = column_sql.split()[0]
    if not _has_column(inspector, table_name, column_name):
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"))


def run_migration():
    engine = create_engine(settings.database_url)

    with engine.begin() as connection:
        inspector = inspect(connection)

        if not _has_table(inspector, "billing_targets"):
            connection.execute(text("""
                CREATE TABLE billing_targets (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    target_type VARCHAR(40) NOT NULL DEFAULT 'internal_area',
                    billing_email VARCHAR(255),
                    cc_emails TEXT,
                    tax_id VARCHAR(50),
                    address TEXT,
                    contact_name VARCHAR(255),
                    cost_center_code VARCHAR(100),
                    source_type VARCHAR(40),
                    source_id INTEGER,
                    is_active BOOLEAN DEFAULT TRUE,
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_billing_targets_name ON billing_targets(name)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_billing_targets_type ON billing_targets(target_type)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_billing_targets_cost_center ON billing_targets(cost_center_code)"))

        inspector = inspect(connection)
        _add_column_if_missing(connection, inspector, "lease_contracts", "billing_target_id INTEGER")
        _add_column_if_missing(connection, inspector, "invoices", "billing_target_id INTEGER")
        _add_column_if_missing(connection, inspector, "invoices", "deployment_mode VARCHAR(30) NOT NULL DEFAULT 'internal_customer'")
        _add_column_if_missing(connection, inspector, "invoices", "document_type VARCHAR(40) DEFAULT 'internal_invoice'")
        _add_column_if_missing(connection, inspector, "invoices", "recipient_name VARCHAR(255)")
        _add_column_if_missing(connection, inspector, "invoices", "recipient_email VARCHAR(255)")
        _add_column_if_missing(connection, inspector, "invoices", "sent_at TIMESTAMP WITH TIME ZONE")
        _add_column_if_missing(connection, inspector, "invoices", "email_delivery_status VARCHAR(30) DEFAULT 'not_sent'")
        _add_column_if_missing(connection, inspector, "invoices", "email_error TEXT")
        _add_column_if_missing(connection, inspector, "invoices", "digital_invoice_status VARCHAR(30) DEFAULT 'not_configured'")
        _add_column_if_missing(connection, inspector, "invoices", "digital_invoice_provider VARCHAR(50)")
        _add_column_if_missing(connection, inspector, "invoices", "digital_invoice_external_id VARCHAR(100)")
        _add_column_if_missing(connection, inspector, "invoices", "digital_invoice_payload TEXT")

        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_lease_contracts_billing_target_id ON lease_contracts(billing_target_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_invoices_billing_target_id ON invoices(billing_target_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_invoices_deployment_mode ON invoices(deployment_mode)"))

        if not _has_table(inspector, "billing_email_logs"):
            connection.execute(text("""
                CREATE TABLE billing_email_logs (
                    id SERIAL PRIMARY KEY,
                    invoice_id INTEGER NOT NULL,
                    recipient_email VARCHAR(255) NOT NULL,
                    cc_emails TEXT,
                    subject VARCHAR(255) NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    provider_message_id VARCHAR(255),
                    sent_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_billing_email_logs_invoice_id ON billing_email_logs(invoice_id)"))

        if not _has_table(inspector, "billing_automation_rules"):
            connection.execute(text("""
                CREATE TABLE billing_automation_rules (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    scope VARCHAR(30) DEFAULT 'all_active_contracts',
                    contract_id INTEGER,
                    billing_target_id INTEGER,
                    frequency VARCHAR(20) DEFAULT 'monthly',
                    day_of_month INTEGER DEFAULT 1,
                    time_of_day VARCHAR(5) DEFAULT '08:00',
                    auto_generate_invoice BOOLEAN DEFAULT TRUE,
                    auto_send_email BOOLEAN DEFAULT FALSE,
                    invoice_status VARCHAR(20) DEFAULT 'draft',
                    last_run_at TIMESTAMP WITH TIME ZONE,
                    next_run_at TIMESTAMP WITH TIME ZONE,
                    run_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    last_error TEXT,
                    created_by VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_billing_automation_rules_active ON billing_automation_rules(is_active)"))

        if not _has_table(inspector, "billing_automation_runs"):
            connection.execute(text("""
                CREATE TABLE billing_automation_runs (
                    id SERIAL PRIMARY KEY,
                    rule_id INTEGER NOT NULL,
                    billing_period_id INTEGER,
                    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    finished_at TIMESTAMP WITH TIME ZONE,
                    success BOOLEAN DEFAULT FALSE,
                    invoices_created INTEGER DEFAULT 0,
                    emails_sent INTEGER DEFAULT 0,
                    errors TEXT,
                    details TEXT
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_billing_automation_runs_rule_id ON billing_automation_runs(rule_id)"))

        connection.execute(text("""
            INSERT INTO billing_configurations (key, value, description, data_type)
            VALUES ('deployment_mode', 'internal_customer', 'Modo local: cliente interno', 'string')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description
        """))
        connection.execute(text("""
            INSERT INTO billing_configurations (key, value, description, data_type)
            VALUES ('digital_invoice_enabled', 'false', 'Conexion a factura digital reservada para version 2', 'boolean')
            ON CONFLICT (key) DO NOTHING
        """))
        connection.execute(text("""
            INSERT INTO billing_configurations (key, value, description, data_type)
            VALUES ('digital_invoice_provider', 'pending', 'Proveedor de factura digital pendiente de configuracion', 'string')
            ON CONFLICT (key) DO NOTHING
        """))


if __name__ == "__main__":
    run_migration()
    print("Migration completed: billing deployment paradigm added")