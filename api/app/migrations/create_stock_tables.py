"""
Migration: Create stock management tables
- stock_items: Items in inventory
- stock_movements: Movement history (in/out)
- stock_locations: Storage locations
"""

from sqlalchemy import text

def upgrade(connection):
    # Create stock_locations table
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_locations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            location_type VARCHAR(50) DEFAULT 'warehouse', -- warehouse, office, storage
            address TEXT,
            responsible_person VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """))

    # Create stock_items table
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_items (
            id SERIAL PRIMARY KEY,
            item_code VARCHAR(100) UNIQUE NOT NULL,
            item_name VARCHAR(200) NOT NULL,
            item_type VARCHAR(50) NOT NULL, -- toner_black, toner_cyan, toner_magenta, toner_yellow, papel, repuesto, otro
            brand VARCHAR(100),
            model VARCHAR(100),
            description TEXT,
            compatible_printers TEXT, -- JSON array of compatible printer models
            unit_of_measure VARCHAR(20) DEFAULT 'unidad', -- unidad, resma, caja, etc
            minimum_stock INTEGER DEFAULT 0,
            maximum_stock INTEGER DEFAULT 100,
            cost_per_unit DECIMAL(10,2) DEFAULT 0.00,
            supplier VARCHAR(100),
            supplier_code VARCHAR(100),
            storage_location_id INTEGER REFERENCES stock_locations(id),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """))

    # Create stock_movements table
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_movements (
            id SERIAL PRIMARY KEY,
            stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
            movement_type VARCHAR(20) NOT NULL, -- 'in' (ingreso), 'out' (salida), 'transfer' (transferencia), 'adjustment' (ajuste)
            quantity INTEGER NOT NULL,
            unit_cost DECIMAL(10,2) DEFAULT 0.00,
            total_cost DECIMAL(10,2) DEFAULT 0.00,
            reference_type VARCHAR(50), -- 'purchase', 'delivery', 'return', 'adjustment', 'transfer'
            reference_id INTEGER, -- ID of related record (toner_request_id, purchase_order_id, etc)
            source_location_id INTEGER REFERENCES stock_locations(id),
            destination_location_id INTEGER REFERENCES stock_locations(id),
            printer_id INTEGER REFERENCES printers(id), -- For deliveries to specific printers
            notes TEXT,
            moved_by VARCHAR(100),
            movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """))

    # Create stock_current table (current stock levels)
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_current (
            id SERIAL PRIMARY KEY,
            stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
            location_id INTEGER NOT NULL REFERENCES stock_locations(id),
            current_quantity INTEGER NOT NULL DEFAULT 0,
            reserved_quantity INTEGER NOT NULL DEFAULT 0, -- Reserved for pending requests
            available_quantity INTEGER GENERATED ALWAYS AS (current_quantity - reserved_quantity) STORED,
            last_movement_date TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_item_id, location_id)
        );
    """))

    # Insert default stock location
    connection.execute(text("""
        INSERT INTO stock_locations (name, description, location_type, responsible_person)
        VALUES ('Almacén Principal', 'Almacén central de insumos', 'warehouse', 'Administrador')
        ON CONFLICT DO NOTHING;
    """))

    # Create indexes for performance
    connection.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date ON stock_movements(stock_item_id, movement_date);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
        CREATE INDEX IF NOT EXISTS idx_stock_current_item ON stock_current(stock_item_id);
        CREATE INDEX IF NOT EXISTS idx_stock_items_type ON stock_items(item_type);
        CREATE INDEX IF NOT EXISTS idx_stock_items_code ON stock_items(item_code);
    """))

def downgrade(connection):
    connection.execute(text("DROP TABLE IF EXISTS stock_current CASCADE;"))
    connection.execute(text("DROP TABLE IF EXISTS stock_movements CASCADE;"))
    connection.execute(text("DROP TABLE IF EXISTS stock_items CASCADE;"))
    connection.execute(text("DROP TABLE IF EXISTS stock_locations CASCADE;"))