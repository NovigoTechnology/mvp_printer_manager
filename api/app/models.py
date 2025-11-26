from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db import Base

class Printer(Base):
    __tablename__ = "printers"
    
    id = Column(Integer, primary_key=True, index=True)
    # Información básica
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    serial_number = Column(String, unique=True, index=True)  # Número de serie
    asset_tag = Column(String, unique=True, nullable=False, index=True)      # Etiqueta de inventario
    
    # Configuración de red
    ip = Column(String, unique=True, nullable=False)
    mac_address = Column(String)
    hostname = Column(String)
    snmp_profile = Column(String, default="generic_v2c")
    
    # Características técnicas
    is_color = Column(Boolean, default=False)
    printer_type = Column(String, default="printer")  # printer, multifunction, scanner
    print_technology = Column(String)  # Láser, Inyección, Matriz, etc.
    max_paper_size = Column(String)    # A4, A3, Letter, etc.
    duplex_capable = Column(Boolean, default=False)
    network_capable = Column(Boolean, default=True)
    wireless_capable = Column(Boolean, default=False)
    
    # Información de ubicación
    sector = Column(String)
    location = Column(String)
    floor = Column(String)
    building = Column(String)
    department = Column(String)
    
    # Información de adquisición
    supplier = Column(String)           # Proveedor
    purchase_date = Column(DateTime(timezone=True))
    installation_date = Column(DateTime(timezone=True))
    warranty_expiry = Column(DateTime(timezone=True))
    lease_contract = Column(String)     # Número de contrato si es arrendada
    
    # Estado y propiedad
    ownership_type = Column(String, default="owned")  # owned, leased, rented
    status = Column(String, default="active")         # active, inactive, maintenance, retired
    condition = Column(String, default="good")        # excellent, good, fair, poor
    equipment_condition = Column(String, nullable=False, default="new")  # new, used
    
    # Contadores iniciales (solo para equipos usados)
    initial_counter_bw = Column(Integer, default=0)
    initial_counter_color = Column(Integer, default=0)
    initial_counter_total = Column(Integer, default=0)
    
    # Información adicional
    notes = Column(Text)
    responsible_person = Column(String)  # Persona responsable
    cost_center = Column(String)         # Centro de costo
    
    # Información de insumos
    toner_black_code = Column(String)    # Código del tóner negro
    toner_cyan_code = Column(String)     # Código del tóner cian
    toner_magenta_code = Column(String)  # Código del tóner magenta
    toner_yellow_code = Column(String)   # Código del tóner amarillo
    other_supplies = Column(Text)        # Otros insumos (tambores, fusores, etc.)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    incidents = relationship("Incident", back_populates="printer")
    usage_reports = relationship("UsageReport", back_populates="printer")
    monthly_counters = relationship("MonthlyCounter", back_populates="printer")
    counter_readings = relationship("CounterReading", back_populates="printer")
    invoice_lines = relationship("InvoiceLine", back_populates="printer")
    ip_history = relationship("PrinterIPHistory", back_populates="printer", cascade="all, delete-orphan")

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="open")  # open, in_progress, resolved
    priority = Column(String, default="medium")  # low, medium, high, critical
    incident_type = Column(String, default="general")  # general, solicitud_insumos, solicitud_servicio
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))
    
    # Relationships
    printer = relationship("Printer", back_populates="incidents")
    toner_requests = relationship("TonerRequest", back_populates="incident")

class UsageReport(Base):
    __tablename__ = "usage_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    pages_printed_mono = Column(Integer, default=0)
    pages_printed_color = Column(Integer, default=0)
    toner_level_black = Column(Float)
    toner_level_cyan = Column(Float)
    toner_level_magenta = Column(Float)
    toner_level_yellow = Column(Float)
    paper_level = Column(Float)
    status = Column(String)  # online, offline, error, warning
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    printer = relationship("Printer", back_populates="usage_reports")

class MonthlyCounter(Base):
    __tablename__ = "monthly_counters"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    
    # Current counters
    counter_bw = Column(Integer, default=0)      # Black & White counter
    counter_color = Column(Integer, default=0)   # Color counter
    counter_total = Column(Integer, default=0)   # Total counter
    
    # Previous day counters (for calculating daily differences)
    previous_counter_bw = Column(Integer, default=0)
    previous_counter_color = Column(Integer, default=0)
    previous_counter_total = Column(Integer, default=0)
    
    # Calculated pages printed since last reading
    pages_printed_bw = Column(Integer, default=0)
    pages_printed_color = Column(Integer, default=0)
    pages_printed_total = Column(Integer, default=0)
    
    # Additional information
    notes = Column(Text)
    locked = Column(Boolean, default=True)  # Locked by default after creation
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    printer = relationship("Printer", back_populates="monthly_counters")
    
    # CONSTRAINT REMOVED: Allow multiple records per printer/month for full history
    # Original constraint: UniqueConstraint('printer_id', 'year', 'month', name='unique_printer_month_year')
    # Removed to enable complete counter collection history
    __table_args__ = ()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class LeaseContract(Base):
    __tablename__ = "lease_contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    # Información básica del contrato
    contract_number = Column(String, unique=True, nullable=False, index=True)
    contract_name = Column(String, nullable=False)
    supplier = Column(String, nullable=False)  # Proveedor/Empresa de arrendamiento
    
    # Tipo de contrato
    contract_type = Column(String, nullable=False)  # cost_per_copy, fixed_cost_per_quantity, monthly_fixed, annual_fixed
    
    # Detalles de costos
    cost_bw_per_copy = Column(Float, default=0)      # Costo por copia B&N
    cost_color_per_copy = Column(Float, default=0)   # Costo por copia a color
    fixed_monthly_cost = Column(Float, default=0)    # Costo fijo mensual
    fixed_annual_cost = Column(Float, default=0)     # Costo fijo anual
    included_copies_bw = Column(Integer, default=0)  # Copias B&N incluidas en costo fijo
    included_copies_color = Column(Integer, default=0)  # Copias color incluidas en costo fijo
    
    # Costos de páginas excedentes (cuando hay límite de copias incluidas)
    overage_cost_bw = Column(Float, default=0)       # Costo por copia B&N excedente
    overage_cost_color = Column(Float, default=0)    # Costo por copia a color excedente
    
    # Soporte multimoneda
    currency = Column(String, default="ARS")  # ARS (Pesos Argentinos) o USD (Dólares)
    exchange_rate = Column(Float, default=1.0)  # Tasa de cambio al momento del contrato
    
    # Costos en moneda alternativa (para conversión)
    cost_bw_per_copy_usd = Column(Float, default=0)    # Costo por copia B&N en USD
    cost_color_per_copy_usd = Column(Float, default=0) # Costo por copia Color en USD
    fixed_monthly_cost_usd = Column(Float, default=0)  # Costo fijo mensual en USD
    fixed_annual_cost_usd = Column(Float, default=0)   # Costo fijo anual en USD
    overage_cost_bw_usd = Column(Float, default=0)     # Costo por copia B&N excedente en USD
    overage_cost_color_usd = Column(Float, default=0)  # Costo por copia Color excedente en USD
    
    # Detalles de equipos
    total_printers = Column(Integer, default=0)           # Total de equipos
    printers_bw_only = Column(Integer, default=0)         # Solo impresoras B&N
    printers_color = Column(Integer, default=0)           # Impresoras a color
    multifunction_devices = Column(Integer, default=0)    # Equipos multifunción
    
    # Fechas del contrato
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    renewal_date = Column(DateTime(timezone=True))  # Fecha de renovación automática
    
    # Estado y condiciones
    status = Column(String, default="active")  # active, expired, cancelled, suspended
    auto_renewal = Column(Boolean, default=False)
    renewal_notice_days = Column(Integer, default=30)  # Días de aviso para renovación
    
    # Información de contacto
    contact_person = Column(String)
    contact_email = Column(String)
    contact_phone = Column(String)
    contact_position = Column(String)
    
    # Información administrativa
    priority = Column(String, default="medium")  # low, medium, high, critical
    department = Column(String)
    cost_center = Column(String)
    budget_code = Column(String)
    
    # Observaciones y notas
    internal_notes = Column(Text)
    special_conditions = Column(Text)
    terms_and_conditions = Column(Text)
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contract_printers = relationship("ContractPrinter", back_populates="contract")
    invoices = relationship("Invoice", back_populates="contract")
    contract_companies = relationship("ContractCompany", back_populates="contract")

class ContractPrinter(Base):
    __tablename__ = "contract_printers"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("lease_contracts.id"), nullable=False)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    
    # Detalles específicos del equipo en el contrato
    device_type = Column(String, nullable=False)  # printer_bw, printer_color, multifunction
    monthly_included_copies_bw = Column(Integer, default=0)
    monthly_included_copies_color = Column(Integer, default=0)
    overage_cost_bw = Column(Float, default=0)  # Costo por copia adicional B&N
    overage_cost_color = Column(Float, default=0)  # Costo por copia adicional color
    
    # Fechas específicas del equipo
    installation_date = Column(DateTime(timezone=True))
    removal_date = Column(DateTime(timezone=True))
    
    # Estado
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contract = relationship("LeaseContract", back_populates="contract_printers")
    printer = relationship("Printer")
    
    # Unique constraint to prevent duplicate printer assignments to same contract
    __table_args__ = (
        UniqueConstraint('contract_id', 'printer_id', name='unique_contract_printer'),
    )

class TonerRequest(Base):
    __tablename__ = "toner_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)  # Incidente relacionado
    
    # Información del pedido
    request_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pending")  # pending, approved, ordered, delivered, cancelled
    priority = Column(String, default="normal")  # low, normal, high, urgent
    supply_type = Column(String, default="insumos")  # insumos, servicio
    
    # Tóners solicitados
    toner_black_requested = Column(Boolean, default=False)
    toner_black_quantity = Column(Integer, default=1)
    toner_cyan_requested = Column(Boolean, default=False)
    toner_cyan_quantity = Column(Integer, default=1)
    toner_magenta_requested = Column(Boolean, default=False)
    toner_magenta_quantity = Column(Integer, default=1)
    toner_yellow_requested = Column(Boolean, default=False)
    toner_yellow_quantity = Column(Integer, default=1)
    
    # Códigos específicos (por si han cambiado desde el registro del equipo)
    toner_black_code = Column(String)
    toner_cyan_code = Column(String)
    toner_magenta_code = Column(String)
    toner_yellow_code = Column(String)
    
    # Información adicional
    other_supplies_requested = Column(Text)  # Otros insumos solicitados
    justification = Column(Text)  # Justificación del pedido
    notes = Column(Text)  # Notas adicionales
    
    # Información del solicitante
    requested_by = Column(String)  # Quien solicita
    department = Column(String)  # Departamento solicitante
    cost_center = Column(String)  # Centro de costo
    
    # Fechas de seguimiento
    approved_date = Column(DateTime(timezone=True))
    ordered_date = Column(DateTime(timezone=True))
    delivered_date = Column(DateTime(timezone=True))
    cancelled_date = Column(DateTime(timezone=True))
    
    # Aprobación
    approved_by = Column(String)  # Quien aprueba
    rejection_reason = Column(Text)  # Razón de rechazo si aplica
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    printer = relationship("Printer")
    incident = relationship("Incident", back_populates="toner_requests")

class StockLocation(Base):
    __tablename__ = "stock_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    location_type = Column(String, default="warehouse")  # warehouse, office, storage
    address = Column(Text)
    responsible_person = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    stock_items = relationship("StockItem", back_populates="storage_location")
    stock_current = relationship("StockCurrent", back_populates="location")

class StockItem(Base):
    __tablename__ = "stock_items"
    
    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String, unique=True, nullable=False, index=True)
    item_name = Column(String, nullable=False)
    item_type = Column(String, nullable=False)  # toner_black, toner_cyan, etc.
    brand = Column(String)
    model = Column(String)
    description = Column(Text)
    compatible_printers = Column(Text)  # JSON array of compatible printer models
    unit_of_measure = Column(String, default="unidad")
    minimum_stock = Column(Integer, default=0)
    maximum_stock = Column(Integer, default=100)
    cost_per_unit = Column(Float, default=0.00)
    supplier = Column(String)
    supplier_code = Column(String)
    storage_location_id = Column(Integer, ForeignKey("stock_locations.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    storage_location = relationship("StockLocation", back_populates="stock_items")
    movements = relationship("StockMovement", back_populates="stock_item")
    stock_current = relationship("StockCurrent", back_populates="stock_item")

class StockMovement(Base):
    __tablename__ = "stock_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    movement_type = Column(String, nullable=False)  # in, out, transfer, adjustment
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, default=0.00)
    total_cost = Column(Float, default=0.00)
    reference_type = Column(String)  # purchase, delivery, return, adjustment, transfer
    reference_id = Column(Integer)
    source_location_id = Column(Integer, ForeignKey("stock_locations.id"))
    destination_location_id = Column(Integer, ForeignKey("stock_locations.id"))
    printer_id = Column(Integer, ForeignKey("printers.id"))
    notes = Column(Text)
    moved_by = Column(String)
    movement_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    stock_item = relationship("StockItem", back_populates="movements")
    source_location = relationship("StockLocation", foreign_keys=[source_location_id])
    destination_location = relationship("StockLocation", foreign_keys=[destination_location_id])
    printer = relationship("Printer")

class StockCurrent(Base):
    __tablename__ = "stock_current"
    
    id = Column(Integer, primary_key=True, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("stock_locations.id"), nullable=False)
    current_quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    last_movement_date = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    stock_item = relationship("StockItem", back_populates="stock_current")
    location = relationship("StockLocation", back_populates="stock_current")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('stock_item_id', 'location_id', name='unique_stock_item_location'),
    )

class PrinterSupply(Base):
    __tablename__ = "printer_supplies"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    is_primary = Column(Boolean, default=False)  # Si es el insumo principal de esta impresora
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    printer = relationship("Printer")
    stock_item = relationship("StockItem")
    
    # Unique constraint - una impresora no puede tener el mismo insumo duplicado
    __table_args__ = (
        UniqueConstraint('printer_id', 'stock_item_id', name='unique_printer_stock_item'),
    )

class CounterSchedule(Base):
    __tablename__ = "counter_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # Configuración de la programación
    schedule_type = Column(String, nullable=False)  # interval, cron, daily, weekly, monthly
    interval_minutes = Column(Integer)  # Para schedule_type=interval
    cron_expression = Column(String)    # Para schedule_type=cron
    time_of_day = Column(String)        # Para daily/weekly/monthly (HH:MM format)
    day_of_week = Column(Integer)       # Para weekly (0=Monday, 6=Sunday)
    day_of_month = Column(Integer)      # Para monthly (1-31)
    
    # Configuración de impresoras
    target_type = Column(String, nullable=False)  # all, selection, single
    printer_ids = Column(Text)          # JSON array of printer IDs for selection
    
    # Estado y configuración
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True))
    run_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    last_error = Column(Text)
    
    # Opciones adicionales
    retry_on_failure = Column(Boolean, default=True)
    max_retries = Column(Integer, default=3)
    notify_on_failure = Column(Boolean, default=False)
    notification_emails = Column(Text)  # JSON array of emails
    
    # Metadata
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    executions = relationship("CounterScheduleExecution", back_populates="schedule")

class CounterScheduleExecution(Base):
    __tablename__ = "counter_schedule_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("counter_schedules.id"), nullable=False)
    execution_time = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, nullable=False)
    error_message = Column(Text, nullable=True)
    printers_processed = Column(Integer, default=0)
    printers_successful = Column(Integer, default=0)
    printers_failed = Column(Integer, default=0)
    total_reports_created = Column(Integer, default=0)
    execution_duration_seconds = Column(Float, nullable=True)
    retry_count = Column(Integer, default=0)
    details = Column(Text, nullable=True)  # JSON con detalles por impresora
    
    # Relationships
    schedule = relationship("CounterSchedule", back_populates="executions")


class DiscoveryConfig(Base):
    __tablename__ = "discovery_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Nombre descriptivo de la configuración
    ip_ranges = Column(Text, nullable=False)    # Rangos IP separados por comas (ej: "10.10.9.1-10.10.9.50,192.168.1.1-192.168.1.100")
    description = Column(String(255), nullable=True)  # Descripción opcional
    is_active = Column(Boolean, default=True)   # Si la configuración está activa
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<DiscoveryConfig(name='{self.name}', ip_ranges='{self.ip_ranges}')>"


# =============================================================================
# BILLING MODELS
# =============================================================================

class BillingPeriod(Base):
    """Período de facturación - define las fechas de corte para facturación"""
    __tablename__ = "billing_periods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Ej: "Noviembre 2025"
    start_date = Column(DateTime(timezone=True), nullable=False)   # Fecha inicio del período
    end_date = Column(DateTime(timezone=True), nullable=False)     # Fecha fin del período
    cut_off_date = Column(DateTime(timezone=True), nullable=False) # Fecha de corte para lecturas
    status = Column(String(20), default="open") # open, closed, billed
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    counter_readings = relationship("CounterReading", back_populates="billing_period")
    invoices = relationship("Invoice", back_populates="billing_period")

class CounterReading(Base):
    """Lectura de contadores por impresora en una fecha específica"""
    __tablename__ = "counter_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    billing_period_id = Column(Integer, ForeignKey("billing_periods.id"), nullable=False)
    reading_date = Column(DateTime(timezone=True), nullable=False)
    
    # Contadores actuales
    counter_bw_current = Column(Integer, default=0)      # Contador actual B/N
    counter_color_current = Column(Integer, default=0)   # Contador actual color
    counter_total_current = Column(Integer, default=0)   # Contador total actual
    
    # Contadores del período anterior (para calcular diferencia)
    counter_bw_previous = Column(Integer, default=0)     # Contador anterior B/N
    counter_color_previous = Column(Integer, default=0)  # Contador anterior color
    counter_total_previous = Column(Integer, default=0)  # Contador total anterior
    
    # Impresiones del período (calculadas)
    prints_bw_period = Column(Integer, default=0)        # Impresiones B/N del período
    prints_color_period = Column(Integer, default=0)     # Impresiones color del período
    prints_total_period = Column(Integer, default=0)     # Impresiones totales del período
    
    # Metadatos
    reading_method = Column(String(20), default="manual") # manual, snmp, automatic
    notes = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    printer = relationship("Printer", back_populates="counter_readings")
    billing_period = relationship("BillingPeriod", back_populates="counter_readings")

class Invoice(Base):
    """Factura generada para un contrato en un período específico"""
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    contract_id = Column(Integer, ForeignKey("lease_contracts.id"), nullable=False)
    billing_period_id = Column(Integer, ForeignKey("billing_periods.id"), nullable=False)
    
    # Fechas
    invoice_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True))
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Montos
    subtotal = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    
    # Estado
    status = Column(String(20), default="draft")  # draft, sent, paid, overdue, cancelled
    
    # Información adicional
    currency = Column(String(3), default="ARS")
    tax_rate = Column(Float, default=21.00)  # IVA 21%
    notes = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    contract = relationship("LeaseContract", back_populates="invoices")
    billing_period = relationship("BillingPeriod", back_populates="invoices")
    invoice_lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceLine(Base):
    """Línea de detalle de una factura"""
    __tablename__ = "invoice_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    printer_id = Column(Integer, ForeignKey("printers.id"))  # Opcional, para líneas específicas de impresora
    
    # Descripción del ítem
    description = Column(String(255), nullable=False)
    item_type = Column(String(30), nullable=False)  # rental, copies_bw, copies_color, fixed_cost, overage
    
    # Cantidades
    quantity = Column(Integer, default=0)           # Cantidad de copias, meses, etc.
    unit_price = Column(Float, default=0)  # Precio unitario
    line_total = Column(Float, default=0) # Total de la línea
    
    # Información adicional
    period_info = Column(Text)  # JSON con info del período, contadores, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    invoice = relationship("Invoice", back_populates="invoice_lines")
    printer = relationship("Printer", back_populates="invoice_lines")

class BillingConfiguration(Base):
    """Configuración global del módulo de facturación"""
    __tablename__ = "billing_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String(255))
    data_type = Column(String(20), default="string")  # string, integer, decimal, boolean, json
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# =============================================================================
# EXCHANGE RATES MODELS
# =============================================================================

class ExchangeRate(Base):
    """Histórico diario de tasas de cambio"""
    __tablename__ = "exchange_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)  # Fecha de la tasa
    base_currency = Column(String(3), nullable=False, default="ARS")   # Moneda base (ARS)
    target_currency = Column(String(3), nullable=False, default="USD")  # Moneda objetivo (USD)
    rate = Column(Float, nullable=False)                               # Tasa de cambio (1 ARS = rate USD)
    
    # Fuente y metadatos
    source = Column(String(50), nullable=False, default="manual")      # manual, api_bna, api_dolar, etc.
    source_url = Column(String(255))                                   # URL de la fuente si es API
    bid_rate = Column(Float)                                          # Tasa de compra (opcional)
    ask_rate = Column(Float)                                          # Tasa de venta (opcional)
    
    # Validación y estado
    is_active = Column(Boolean, default=True)                         # Si la tasa está activa
    is_manual_override = Column(Boolean, default=False)               # Si es una tasa manual
    confidence_level = Column(Float, default=1.0)                    # Nivel de confianza (0-1)
    
    # Metadatos adicionales
    raw_data = Column(Text)                                           # Datos raw del API (JSON)
    notes = Column(Text)                                              # Notas adicionales
    created_by = Column(String(100))                                  # Usuario que creó la tasa manual
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Constraint único por fecha y par de monedas
    __table_args__ = (
        UniqueConstraint('date', 'base_currency', 'target_currency', name='unique_rate_per_day'),
    )

class ExchangeRateSource(Base):
    """Configuración de fuentes de tasas de cambio"""
    __tablename__ = "exchange_rate_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)           # Nombre de la fuente
    description = Column(String(255))                                # Descripción de la fuente
    api_url = Column(String(500))                                    # URL del API
    api_key = Column(String(255))                                    # API Key si es necesaria
    
    # Configuración del API
    request_method = Column(String(10), default="GET")               # GET, POST
    request_headers = Column(Text)                                   # Headers JSON
    request_body = Column(Text)                                      # Body del request JSON
    response_path = Column(String(255))                              # Path JSON para extraer la tasa
    
    # Par de monedas soportado
    base_currency = Column(String(3), default="ARS")
    target_currency = Column(String(3), default="USD")
    
    # Configuración de actualización
    update_frequency_hours = Column(Integer, default=24)             # Frecuencia de actualización
    is_active = Column(Boolean, default=True)                       # Si la fuente está activa
    priority = Column(Integer, default=1)                           # Prioridad (1 = más alta)
    
    # Estadísticas
    last_successful_update = Column(DateTime(timezone=True))
    last_error = Column(Text)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# =============================================================================
# COMPANY MODELS
# =============================================================================

class Company(Base):
    """Modelo de empresa/cliente"""
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Información básica
    name = Column(String(255), nullable=False, index=True)          # Nombre de la empresa
    legal_name = Column(String(255), nullable=True)                # Razón social
    tax_id = Column(String(50), unique=True, nullable=False, index=True)  # RUT/CUIT/NIT
    business_type = Column(String(100), nullable=True)             # Tipo de empresa
    
    # Información de contacto
    address = Column(Text, nullable=True)                          # Dirección completa
    city = Column(String(100), nullable=True)                      # Ciudad
    state = Column(String(100), nullable=True)                     # Estado/Provincia
    postal_code = Column(String(20), nullable=True)                # Código postal
    country = Column(String(100), default="Argentina")             # País
    
    # Contacto principal
    contact_person = Column(String(255), nullable=True)            # Persona de contacto
    contact_position = Column(String(100), nullable=True)          # Cargo/Posición
    phone = Column(String(50), nullable=True)                      # Teléfono principal
    mobile = Column(String(50), nullable=True)                     # Teléfono móvil
    email = Column(String(255), nullable=True)                     # Email principal
    website = Column(String(255), nullable=True)                   # Sitio web
    
    # Información comercial
    industry = Column(String(100), nullable=True)                  # Industria/Sector
    size = Column(String(50), default="medium")                    # small, medium, large, enterprise
    annual_revenue = Column(Float, nullable=True)                  # Facturación anual
    employee_count = Column(Integer, nullable=True)                # Número de empleados
    
    # Estado y clasificación
    status = Column(String(20), default="active")                  # active, inactive, prospect
    priority = Column(String(20), default="medium")                # low, medium, high, vip
    credit_rating = Column(String(20), nullable=True)              # A, B, C, D
    payment_terms = Column(String(100), default="30 days")         # Términos de pago
    
    # Información adicional
    notes = Column(Text, nullable=True)                            # Notas generales
    internal_notes = Column(Text, nullable=True)                   # Notas internas
    tags = Column(Text, nullable=True)                             # Tags/Etiquetas (JSON)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contract_companies = relationship("ContractCompany", back_populates="company")

class ContractCompany(Base):
    """Tabla intermedia para relación muchos-a-muchos entre contratos y empresas"""
    __tablename__ = "contract_companies"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("lease_contracts.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Información específica de la relación
    role = Column(String(50), default="client")                    # client, partner, supplier, guarantor
    participation_percentage = Column(Float, default=100.0)        # Porcentaje de participación
    is_primary = Column(Boolean, default=False)                    # Si es la empresa principal
    
    # Fechas específicas de la relación
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Estado de la relación
    is_active = Column(Boolean, default=True)
    
    # Información adicional
    notes = Column(Text, nullable=True)                            # Notas específicas de esta relación
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contract = relationship("LeaseContract", back_populates="contract_companies")
    company = relationship("Company", back_populates="contract_companies")
    
    # Constraint único para evitar duplicados
    __table_args__ = (
        UniqueConstraint('contract_id', 'company_id', name='unique_contract_company'),
    )

class PrinterIPHistory(Base):
    """
    Historial de cambios de IP de impresoras
    Permite rastrear cuando una impresora cambia de ubicación/IP
    """
    __tablename__ = "printer_ip_history"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False)
    old_ip = Column(String(15))  # IP anterior (puede ser NULL en primera asignación)
    new_ip = Column(String(15), nullable=False)  # Nueva IP
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    changed_by = Column(String(100), default='system')  # 'system', 'user', 'discovery'
    reason = Column(String(255))  # 'sector_change', 'network_reconfiguration', 'manual_update', etc.
    notes = Column(Text)  # Notas adicionales sobre el cambio
    
    # Relationships
    printer = relationship("Printer", back_populates="ip_history")

class MedicalPrinterCounter(Base):
    """
    Historial de contadores de impresoras médicas (DRYPIX)
    Almacena snapshots diarios de los contadores de bandejas
    """
    __tablename__ = "medical_printer_counters"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Datos resumidos para consultas rápidas
    total_printed = Column(Integer, default=0)           # Total de copias impresas
    total_available = Column(Integer, default=0)         # Total de copias disponibles
    total_trays_loaded = Column(Integer, default=0)      # Número de bandejas cargadas
    is_online = Column(Boolean, default=True)            # Estado de la impresora
    
    # Datos completos en formato JSON (incluye detalle por bandeja)
    raw_data = Column(Text)  # JSON con estructura completa: {trays: {...}, summary: {...}}
    
    # Metadatos
    collection_method = Column(String(20), default='automatic')  # automatic, manual, api
    notes = Column(Text)
    
    # Relationships
    printer = relationship("Printer")
    
    # Índice compuesto para consultas eficientes por impresora y fecha
    __table_args__ = (
        # Permite múltiples registros por día para tracking detallado
    )

class MedicalPrinterRefill(Base):
    """
    Registro de recargas de cartuchos en impresoras médicas
    Cada cartucho contiene 100 placas para impresión
    """
    __tablename__ = "medical_printer_refills"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False, index=True)
    refill_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Información del cartucho
    tray_name = Column(String(50), nullable=False)       # Nombre de la bandeja (TRAY A, TRAY B, etc)
    cartridge_quantity = Column(Integer, default=1)       # Cantidad de cartuchos cargados
    plates_per_cartridge = Column(Integer, default=100)   # Placas por cartucho (default 100)
    total_plates_added = Column(Integer, nullable=False)  # Total de placas agregadas
    
    # Contadores antes de la recarga
    counter_before_refill = Column(Integer, default=0)    # Contador de impresos antes de recargar
    available_before_refill = Column(Integer, default=0)  # Disponibles antes de recargar
    
    # Contadores después de la recarga
    counter_after_refill = Column(Integer)                # Contador después (puede llenarse después)
    available_after_refill = Column(Integer)              # Disponibles después
    
    # Información del pedido/incidente relacionado
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    toner_request_id = Column(Integer, ForeignKey("toner_requests.id"), nullable=True)
    
    # Información adicional
    batch_number = Column(String(100))                    # Número de lote del cartucho
    expiry_date = Column(DateTime(timezone=True))         # Fecha de vencimiento
    supplier = Column(String(200))                        # Proveedor del insumo
    cost = Column(Float, default=0.0)                     # Costo del cartucho
    
    # Usuario y notas
    loaded_by = Column(String(100))                       # Usuario que cargó el cartucho
    notes = Column(Text)                                  # Notas adicionales
    
    # Relationships
    printer = relationship("Printer")
    incident = relationship("Incident")
    toner_request = relationship("TonerRequest")