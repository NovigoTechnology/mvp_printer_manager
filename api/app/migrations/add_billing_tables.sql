-- Migración para crear tablas del módulo de facturación
-- Fecha: 2025-11-05

-- Tabla para períodos de facturación
CREATE TABLE billing_periods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cut_off_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para lecturas de contadores
CREATE TABLE counter_readings (
    id SERIAL PRIMARY KEY,
    printer_id INTEGER NOT NULL REFERENCES printers(id),
    billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id),
    reading_date DATE NOT NULL,
    
    -- Contadores actuales
    counter_bw_current INTEGER DEFAULT 0,
    counter_color_current INTEGER DEFAULT 0,
    counter_total_current INTEGER DEFAULT 0,
    
    -- Contadores del período anterior
    counter_bw_previous INTEGER DEFAULT 0,
    counter_color_previous INTEGER DEFAULT 0,
    counter_total_previous INTEGER DEFAULT 0,
    
    -- Impresiones del período (calculadas)
    prints_bw_period INTEGER DEFAULT 0,
    prints_color_period INTEGER DEFAULT 0,
    prints_total_period INTEGER DEFAULT 0,
    
    -- Metadatos
    reading_method VARCHAR(20) DEFAULT 'manual',
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(printer_id, billing_period_id)
);

-- Tabla para facturas
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    contract_id INTEGER NOT NULL REFERENCES lease_contracts(id),
    billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id),
    
    -- Fechas
    invoice_date DATE NOT NULL,
    due_date DATE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Montos
    subtotal DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'draft',
    
    -- Información adicional
    currency VARCHAR(3) DEFAULT 'ARS',
    tax_rate DECIMAL(5, 2) DEFAULT 21.00,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(contract_id, billing_period_id)
);

-- Tabla para líneas de factura
CREATE TABLE invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    printer_id INTEGER REFERENCES printers(id),
    
    -- Descripción del ítem
    description VARCHAR(255) NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    
    -- Cantidades
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(8, 4) DEFAULT 0,
    line_total DECIMAL(10, 2) DEFAULT 0,
    
    -- Información adicional
    period_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para configuración del módulo de facturación
CREATE TABLE billing_configurations (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description VARCHAR(255),
    data_type VARCHAR(20) DEFAULT 'string',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX idx_counter_readings_printer_period ON counter_readings(printer_id, billing_period_id);
CREATE INDEX idx_counter_readings_date ON counter_readings(reading_date);
CREATE INDEX idx_invoices_contract ON invoices(contract_id);
CREATE INDEX idx_invoices_period ON invoices(billing_period_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_printer ON invoice_lines(printer_id);

-- Insertar configuraciones iniciales
INSERT INTO billing_configurations (key, value, description, data_type) VALUES
('default_tax_rate', '21.00', 'Tasa de IVA por defecto', 'decimal'),
('currency', 'ARS', 'Moneda por defecto', 'string'),
('invoice_prefix', 'FAC-', 'Prefijo para números de factura', 'string'),
('due_days', '30', 'Días para vencimiento de facturas', 'integer'),
('billing_day', '25', 'Día del mes para corte de facturación', 'integer');

-- Comentarios en las tablas
COMMENT ON TABLE billing_periods IS 'Períodos de facturación con fechas de corte';
COMMENT ON TABLE counter_readings IS 'Lecturas de contadores por impresora y período';
COMMENT ON TABLE invoices IS 'Facturas generadas por contrato y período';
COMMENT ON TABLE invoice_lines IS 'Líneas de detalle de facturas';
COMMENT ON TABLE billing_configurations IS 'Configuración del módulo de facturación';