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

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="open")  # open, in_progress, resolved
    priority = Column(String, default="medium")  # low, medium, high, critical
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))
    
    # Relationships
    printer = relationship("Printer", back_populates="incidents")

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
    
    # Previous month counters (for calculating differences)
    previous_counter_bw = Column(Integer, default=0)
    previous_counter_color = Column(Integer, default=0)
    previous_counter_total = Column(Integer, default=0)
    
    # Calculated pages printed this month
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
    
    # Unique constraint to prevent duplicate records for same printer/month/year
    __table_args__ = (
        UniqueConstraint('printer_id', 'year', 'month', name='unique_printer_month_year'),
    )

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
    
    # Información administrativa
    department = Column(String)
    cost_center = Column(String)
    budget_code = Column(String)
    
    # Observaciones y notas
    terms_and_conditions = Column(Text)
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contract_printers = relationship("ContractPrinter", back_populates="contract")

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
    
    # Información del pedido
    request_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pending")  # pending, approved, ordered, delivered, cancelled
    priority = Column(String, default="normal")  # low, normal, high, urgent
    
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