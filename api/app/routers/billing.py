from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
import json

from pydantic import BaseModel
from ..db import get_db
from ..models import (
    Printer, LeaseContract, ContractPrinter, BillingPeriod, CounterReading,
    Invoice, InvoiceLine, BillingConfiguration, BillingTarget, MonthlyCounter,
    BillingAutomationRule, BillingAutomationRun, BillingEmailLog,
)
from ..services import billing_engine
from ..services.snmp import SNMPService

router = APIRouter(prefix="/billing", tags=["billing"])

# Pydantic models para requests/responses
class BillingPeriodCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    cut_off_date: date
    description: Optional[str] = None

class BillingPeriodResponse(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    cut_off_date: date
    status: str
    description: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class CounterReadingCreate(BaseModel):
    printer_id: int
    billing_period_id: int
    reading_date: date
    counter_bw_current: int = 0
    counter_color_current: int = 0
    counter_total_current: int = 0
    reading_method: str = "manual"
    notes: Optional[str] = None

class CounterReadingResponse(BaseModel):
    id: int
    printer_id: int
    billing_period_id: int
    reading_date: date
    counter_bw_current: int
    counter_color_current: int
    counter_total_current: int
    counter_bw_previous: int
    counter_color_previous: int
    counter_total_previous: int
    prints_bw_period: int
    prints_color_period: int
    prints_total_period: int
    location_snapshot: Optional[str] = None
    reading_method: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    contract_id: int
    billing_period_id: int
    invoice_date: date
    due_date: Optional[date]
    period_start: date
    period_end: date
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: str
    currency: str
    tax_rate: Decimal
    notes: Optional[str]
    billing_target_id: Optional[int] = None
    deployment_mode: Optional[str] = None
    document_type: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    sent_at: Optional[datetime] = None
    email_delivery_status: Optional[str] = None
    digital_invoice_status: Optional[str] = None
    digital_invoice_provider: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BillingDeploymentResponse(BaseModel):
    deployment_mode: str
    mode_label: str
    target_label: str
    document_label: str
    target_type: str
    digital_invoice_enabled: bool
    digital_invoice_provider: str


class BillingTargetResponse(BaseModel):
    id: int
    name: str
    target_type: str
    billing_email: Optional[str]
    cc_emails: Optional[str]
    tax_id: Optional[str]
    address: Optional[str]
    contact_name: Optional[str]
    cost_center_code: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class InvoiceGenerationRequest(BaseModel):
    period_id: int
    contract_id: int
    status: str = "draft"
    send_email: bool = False
    recipient_email: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None


class InvoiceEmailRequest(BaseModel):
    recipient_email: Optional[str] = None


class BillingAutomationRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    scope: str = "all_active_contracts"
    contract_id: Optional[int] = None
    billing_target_id: Optional[int] = None
    frequency: str = "monthly"
    day_of_month: int = 1
    time_of_day: str = "08:00"
    auto_generate_invoice: bool = True
    auto_send_email: bool = False
    invoice_status: str = "draft"
    created_by: Optional[str] = None


class BillingAutomationRuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    scope: str
    contract_id: Optional[int]
    billing_target_id: Optional[int]
    frequency: str
    day_of_month: int
    time_of_day: str
    auto_generate_invoice: bool
    auto_send_email: bool
    invoice_status: str
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    run_count: int
    error_count: int
    last_error: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# DEPLOYMENT AND TARGETS ENDPOINTS

@router.get("/deployment", response_model=BillingDeploymentResponse)
def get_billing_deployment(db: Session = Depends(get_db)):
    """Obtener modo de instalacion y etiquetas de facturacion."""
    mode = billing_engine.ensure_default_deployment_config(db)
    db.commit()
    labels = billing_engine.get_deployment_labels(mode)
    digital_enabled = billing_engine.get_config_value(db, "digital_invoice_enabled", "false").lower() == "true"
    return BillingDeploymentResponse(
        deployment_mode=mode,
        mode_label=labels["mode_label"],
        target_label=labels["target_label"],
        document_label=labels["document_label"],
        target_type=labels["target_type"],
        digital_invoice_enabled=digital_enabled,
        digital_invoice_provider=billing_engine.get_config_value(db, "digital_invoice_provider", "pending"),
    )


@router.get("/targets", response_model=List[BillingTargetResponse])
def list_billing_targets(
    target_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Listar destinos de facturacion internos o externos."""
    query = db.query(BillingTarget)
    if target_type:
        query = query.filter(BillingTarget.target_type == target_type)
    if active_only:
        query = query.filter(BillingTarget.is_active == True)
    return query.order_by(BillingTarget.name.asc()).all()


# BILLING PERIODS ENDPOINTS

@router.get("/periods", response_model=List[BillingPeriodResponse])
def get_billing_periods(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Obtener períodos de facturación"""
    query = db.query(BillingPeriod)
    
    if status:
        query = query.filter(BillingPeriod.status == status)
    
    periods = query.order_by(desc(BillingPeriod.start_date)).offset(skip).limit(limit).all()
    return periods

@router.post("/periods", response_model=BillingPeriodResponse)
def create_billing_period(
    period: BillingPeriodCreate,
    db: Session = Depends(get_db)
):
    """Crear un nuevo período de facturación"""
    
    # Verificar que no exista solapamiento de fechas
    existing = db.query(BillingPeriod).filter(
        and_(
            BillingPeriod.start_date <= period.end_date,
            BillingPeriod.end_date >= period.start_date
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El período se solapa con el período existente: {existing.name}"
        )
    
    db_period = BillingPeriod(**period.dict())
    db.add(db_period)
    db.commit()
    db.refresh(db_period)
    
    return db_period

@router.put("/periods/{period_id}")
def update_billing_period(
    period_id: int,
    period_update: BillingPeriodCreate,
    db: Session = Depends(get_db)
):
    """Actualizar un período de facturación"""
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    if period.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede editar un período cerrado"
        )
    
    # Verificar que no exista otro período con el mismo nombre (excluyendo el actual)
    existing_period = db.query(BillingPeriod).filter(
        and_(BillingPeriod.name == period_update.name, BillingPeriod.id != period_id)
    ).first()
    
    if existing_period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un período con ese nombre"
        )
    
    # Actualizar campos
    period.name = period_update.name
    period.start_date = period_update.start_date
    period.end_date = period_update.end_date
    period.cut_off_date = period_update.cut_off_date
    period.description = period_update.description
    
    db.commit()
    db.refresh(period)
    
    return period

@router.put("/periods/{period_id}/close")
def close_billing_period(
    period_id: int,
    db: Session = Depends(get_db)
):
    """Cerrar un período de facturación"""
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    if period.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El período ya está en estado: {period.status}"
        )
    
    period.status = "closed"
    period.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Período cerrado exitosamente"}

# COUNTER READINGS ENDPOINTS

@router.get("/readings", response_model=List[CounterReadingResponse])
def get_counter_readings(
    period_id: Optional[int] = Query(None),
    printer_id: Optional[int] = Query(None),
    contract_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Obtener lecturas de contadores"""
    query = db.query(CounterReading)
    
    if period_id:
        query = query.filter(CounterReading.billing_period_id == period_id)
    
    if printer_id:
        query = query.filter(CounterReading.printer_id == printer_id)

    if contract_id:
        contract_printer_ids = db.query(ContractPrinter.printer_id).filter(
            ContractPrinter.contract_id == contract_id
        ).subquery()
        query = query.filter(CounterReading.printer_id.in_(contract_printer_ids))

    if period_id:
        period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Período de facturación no encontrado"
            )

        readings = query.order_by(desc(CounterReading.reading_date)).all()
        existing_printer_ids = {reading.printer_id for reading in readings}

        if printer_id:
            candidate_printer_ids = [printer_id]
        elif contract_id:
            candidate_printer_ids = [row[0] for row in db.query(ContractPrinter.printer_id).filter(
                ContractPrinter.contract_id == contract_id
            ).all()]
        else:
            period_end_exclusive = period.end_date + timedelta(days=1)
            candidate_printer_ids = [row[0] for row in db.query(MonthlyCounter.printer_id).filter(
                MonthlyCounter.recorded_at >= period.start_date,
                MonthlyCounter.recorded_at < period_end_exclusive,
            ).distinct().all()]

            if not candidate_printer_ids:
                candidate_printer_ids = [row[0] for row in db.query(MonthlyCounter.printer_id).filter(
                    MonthlyCounter.year == period.start_date.year,
                    MonthlyCounter.month == period.start_date.month,
                ).distinct().all()]

        derived_readings = []
        for candidate_printer_id in candidate_printer_ids:
            if candidate_printer_id in existing_printer_ids:
                continue

            monthly_usage = billing_engine.get_period_usage_from_monthly_counters(db, candidate_printer_id, period)
            if monthly_usage:
                derived_readings.append(monthly_usage)

        combined_readings = list(readings) + derived_readings
        combined_readings.sort(
            key=lambda reading: billing_engine.usage_value(reading, "reading_date"),
            reverse=True,
        )
        return combined_readings[skip:skip + limit]
    
    readings = query.order_by(desc(CounterReading.reading_date)).offset(skip).limit(limit).all()
    return readings

@router.post("/readings", response_model=CounterReadingResponse)
def create_counter_reading(
    reading: CounterReadingCreate,
    db: Session = Depends(get_db)
):
    """Crear una lectura de contadores"""
    
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == reading.printer_id).first()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impresora no encontrada"
        )
    
    # Verificar que el período existe
    period = db.query(BillingPeriod).filter(BillingPeriod.id == reading.billing_period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    # Verificar que no existe una lectura para esta impresora en este período
    existing_reading = db.query(CounterReading).filter(
        and_(
            CounterReading.printer_id == reading.printer_id,
            CounterReading.billing_period_id == reading.billing_period_id
        )
    ).first()
    
    if existing_reading:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una lectura para esta impresora en este período"
        )
    
    # Obtener la lectura anterior para calcular diferencias
    previous_reading = db.query(CounterReading).filter(
        CounterReading.printer_id == reading.printer_id
    ).order_by(desc(CounterReading.reading_date)).first()
    
    # Crear la lectura
    db_reading = CounterReading(**reading.dict())
    db_reading.location_snapshot = printer.location
    
    if previous_reading:
        db_reading.counter_bw_previous = previous_reading.counter_bw_current
        db_reading.counter_color_previous = previous_reading.counter_color_current
        db_reading.counter_total_previous = previous_reading.counter_total_current
        
        # Calcular impresiones del período
        db_reading.prints_bw_period = max(0, reading.counter_bw_current - previous_reading.counter_bw_current)
        db_reading.prints_color_period = max(0, reading.counter_color_current - previous_reading.counter_color_current)
        db_reading.prints_total_period = max(0, reading.counter_total_current - previous_reading.counter_total_current)
    else:
        # Primera lectura - usar contadores iniciales de la impresora
        db_reading.counter_bw_previous = printer.initial_counter_bw or 0
        db_reading.counter_color_previous = printer.initial_counter_color or 0
        db_reading.counter_total_previous = printer.initial_counter_total or 0
        
        db_reading.prints_bw_period = max(0, reading.counter_bw_current - (printer.initial_counter_bw or 0))
        db_reading.prints_color_period = max(0, reading.counter_color_current - (printer.initial_counter_color or 0))
        db_reading.prints_total_period = max(0, reading.counter_total_current - (printer.initial_counter_total or 0))
    
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)
    
    return db_reading

@router.put("/readings/{reading_id}")
def update_counter_reading(
    reading_id: int,
    reading_update: CounterReadingCreate,
    db: Session = Depends(get_db)
):
    """Actualizar una lectura de contadores"""
    
    db_reading = db.query(CounterReading).filter(CounterReading.id == reading_id).first()
    if not db_reading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lectura no encontrada"
        )
    
    # Actualizar campos
    for field, value in reading_update.dict(exclude_unset=True).items():
        setattr(db_reading, field, value)
    
    # Recalcular impresiones del período
    db_reading.prints_bw_period = max(0, db_reading.counter_bw_current - db_reading.counter_bw_previous)
    db_reading.prints_color_period = max(0, db_reading.counter_color_current - db_reading.counter_color_previous)
    db_reading.prints_total_period = max(0, db_reading.counter_total_current - db_reading.counter_total_previous)
    
    db_reading.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Lectura actualizada exitosamente"}

# INVOICE GENERATION

@router.post("/generate-invoices/{period_id}")
def generate_invoices_for_period(
    period_id: int,
    db: Session = Depends(get_db)
):
    """Generar facturas para todos los contratos en un período"""
    
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    if period.status != "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El período debe estar cerrado para generar facturas"
        )
    
    # Obtener todos los contratos activos
    contracts = db.query(LeaseContract).filter(
        LeaseContract.status == "active"
    ).all()
    
    invoices_created = 0
    errors = []
    
    for contract in contracts:
        try:
            invoice = billing_engine.create_invoice(
                db=db,
                period_id=period_id,
                contract_id=contract.id,
                invoice_status="draft",
                send_email=False,
                notes="Generada desde proceso masivo de periodo",
            )
            if invoice.created_at is None:
                db.flush()
            invoices_created += 1
            
        except Exception as e:
            errors.append(f"Error generando factura para contrato {contract.contract_number}: {str(e)}")
    
    db.commit()
    
    return {
        "invoices_created": invoices_created,
        "errors": errors,
        "message": f"Se generaron {invoices_created} facturas exitosamente"
    }

def generate_invoice_lines(db: Session, invoice: Invoice, contract: LeaseContract, period: BillingPeriod) -> Decimal:
    """Generar líneas de factura según el tipo de contrato"""
    return billing_engine.build_invoice_lines(db, invoice, contract, period)

def get_config_value(db: Session, key: str, default: str = "") -> str:
    """Obtener valor de configuración"""
    config = db.query(BillingConfiguration).filter(BillingConfiguration.key == key).first()
    return config.value if config else default

# INVOICES ENDPOINTS

@router.get("/invoices", response_model=List[InvoiceResponse])
def get_invoices(
    period_id: Optional[int] = Query(None),
    contract_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Obtener facturas"""
    query = db.query(Invoice)
    
    if period_id:
        query = query.filter(Invoice.billing_period_id == period_id)
    
    if contract_id:
        query = query.filter(Invoice.contract_id == contract_id)
    
    if status:
        query = query.filter(Invoice.status == status)
    
    invoices = query.order_by(desc(Invoice.invoice_date)).offset(skip).limit(limit).all()
    return invoices


@router.post("/invoices/generate", response_model=InvoiceResponse)
def generate_single_invoice(
    payload: InvoiceGenerationRequest,
    db: Session = Depends(get_db),
):
    """Generar una factura real desde el wizard o un flujo manual."""
    try:
        invoice = billing_engine.create_invoice(
            db=db,
            period_id=payload.period_id,
            contract_id=payload.contract_id,
            invoice_status=payload.status,
            send_email=payload.send_email,
            recipient_email=payload.recipient_email,
            notes=payload.notes,
            created_by=payload.created_by,
        )
        db.commit()
        db.refresh(invoice)
        return invoice
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generando factura: {str(exc)}")


@router.post("/invoices/{invoice_id}/send-email")
def send_invoice_by_email(
    invoice_id: int,
    payload: InvoiceEmailRequest = InvoiceEmailRequest(),
    db: Session = Depends(get_db),
):
    """Enviar factura por email usando SMTP configurado y registrar el resultado."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")

    success = billing_engine.send_invoice_email(db, invoice, recipient_email=payload.recipient_email)
    db.commit()

    return {
        "success": success,
        "status": invoice.email_delivery_status,
        "message": "Factura enviada correctamente" if success else (invoice.email_error or "No se pudo enviar la factura"),
        "error_detail": None if success else invoice.email_error,
    }


@router.get("/automation-rules", response_model=List[BillingAutomationRuleResponse])
def list_billing_automation_rules(db: Session = Depends(get_db)):
    """Listar reglas de automatizacion de facturacion."""
    return db.query(BillingAutomationRule).order_by(BillingAutomationRule.created_at.desc()).all()


@router.post("/automation-rules", response_model=BillingAutomationRuleResponse)
def create_billing_automation_rule(
    payload: BillingAutomationRuleCreate,
    db: Session = Depends(get_db),
):
    """Crear una regla de automatizacion para generar facturas por periodo."""
    rule = BillingAutomationRule(**payload.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/automation-rules/{rule_id}/run")
def run_billing_automation_rule(
    rule_id: int,
    period_id: int,
    db: Session = Depends(get_db),
):
    """Ejecutar manualmente una regla de automatizacion para un periodo."""
    rule = db.query(BillingAutomationRule).filter(BillingAutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regla de automatizacion no encontrada")
    if not rule.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La regla no esta activa")

    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Periodo de facturacion no encontrado")

    query = db.query(LeaseContract).filter(LeaseContract.status == "active")
    if rule.contract_id:
        query = query.filter(LeaseContract.id == rule.contract_id)
    if rule.billing_target_id:
        query = query.filter(LeaseContract.billing_target_id == rule.billing_target_id)

    contracts = query.all()
    run = BillingAutomationRun(rule_id=rule.id, billing_period_id=period.id)
    db.add(run)
    db.flush()

    invoices_created = 0
    emails_sent = 0
    errors = []

    for contract in contracts:
        try:
            invoice = billing_engine.create_invoice(
                db=db,
                period_id=period.id,
                contract_id=contract.id,
                invoice_status=rule.invoice_status,
                send_email=False,
                notes=f"Generada por regla automatica: {rule.name}",
                created_by=rule.created_by,
            )
            invoices_created += 1
            if rule.auto_send_email:
                if billing_engine.send_invoice_email(db, invoice):
                    emails_sent += 1
        except Exception as exc:
            errors.append(f"Contrato {contract.contract_number}: {str(exc)}")

    now = datetime.utcnow()
    run.finished_at = now
    run.success = len(errors) == 0
    run.invoices_created = invoices_created
    run.emails_sent = emails_sent
    run.errors = json.dumps(errors, ensure_ascii=False)
    rule.last_run_at = now
    rule.run_count = (rule.run_count or 0) + 1
    if errors:
        rule.error_count = (rule.error_count or 0) + 1
        rule.last_error = "; ".join(errors[:3])
    else:
        rule.last_error = None

    db.commit()

    return {
        "success": run.success,
        "invoices_created": invoices_created,
        "emails_sent": emails_sent,
        "errors": errors,
        "message": f"Automatizacion ejecutada: {invoices_created} facturas generadas",
    }

@router.get("/invoices/{invoice_id}")
def get_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db)
):
    """Obtener detalle completo de una factura"""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    # Obtener líneas de factura
    lines = db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice_id).all()
    
    # Obtener información del contrato
    contract = db.query(LeaseContract).filter(LeaseContract.id == invoice.contract_id).first()
    
    # Obtener información del período
    period = db.query(BillingPeriod).filter(BillingPeriod.id == invoice.billing_period_id).first()
    target = db.query(BillingTarget).filter(BillingTarget.id == invoice.billing_target_id).first() if invoice.billing_target_id else None
    email_logs = db.query(BillingEmailLog).filter(BillingEmailLog.invoice_id == invoice_id).order_by(desc(BillingEmailLog.created_at)).all()
    
    return {
        "invoice": invoice,
        "lines": lines,
        "contract": contract,
        "period": period,
        "billing_target": target,
        "email_logs": email_logs,
    }

# AUTOMATIC SNMP READING ENDPOINTS

@router.post("/readings/snmp-bulk/{period_id}")
def create_snmp_bulk_readings(
    period_id: int,
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Realizar lecturas automáticas SNMP para un período específico"""
    
    # Verificar que el período existe
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    # Obtener impresoras según el filtro
    if contract_id:
        # Lecturas para un contrato específico
        contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contrato no encontrado"
            )
        
        contract_printers = db.query(ContractPrinter).filter(
            ContractPrinter.contract_id == contract_id
        ).all()
        
        printer_ids = [cp.printer_id for cp in contract_printers]
        printers = db.query(Printer).filter(
            and_(
                Printer.id.in_(printer_ids),
                Printer.status == "active",
                Printer.ignore_counters == False
            )
        ).all()
    else:
        # Lecturas para todas las impresoras activas
        printers = db.query(Printer).filter(
            Printer.status == "active",
            Printer.ignore_counters == False
        ).all()
    
    if not printers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontraron impresoras activas"
        )
    
    # Inicializar servicio SNMP
    snmp_service = SNMPService()
    results = {
        "success": [],
        "errors": [],
        "total_printers": len(printers),
        "successful_readings": 0
    }
    
    for printer in printers:
        try:
            # Verificar si ya existe una lectura para esta impresora en este período
            existing_reading = db.query(CounterReading).filter(
                and_(
                    CounterReading.printer_id == printer.id,
                    CounterReading.billing_period_id == period_id
                )
            ).first()
            
            if existing_reading:
                results["errors"].append({
                    "printer_id": printer.id,
                    "ip_address": printer.ip,
                    "error": "Ya existe una lectura para este período"
                })
                continue
            
            # Determinar el perfil SNMP según la marca
            profile = 'generic_v2c'
            if printer.brand:
                brand_lower = printer.brand.lower()
                if 'hp' in brand_lower:
                    profile = 'hp'
                elif 'oki' in brand_lower:
                    profile = 'oki'
                elif 'brother' in brand_lower:
                    profile = 'brother'
                elif 'lexmark' in brand_lower:
                    profile = 'lexmark'
                elif 'epson' in brand_lower:
                    profile = 'epson'
                elif 'ricoh' in brand_lower:
                    profile = 'ricoh'
            
            # Realizar consulta SNMP
            snmp_data = snmp_service.poll_printer(printer.ip, profile)
            
            if not snmp_data or snmp_data.get('status') == 'offline':
                results["errors"].append({
                    "printer_id": printer.id,
                    "ip_address": printer.ip,
                    "error": "No se pudo conectar vía SNMP"
                })
                continue
            
            # Determinar el contrato de la impresora si no se especificó uno
            reading_contract_id = contract_id
            if not reading_contract_id:
                # Buscar el contrato activo de la impresora
                contract_printer = db.query(ContractPrinter).join(
                    LeaseContract, ContractPrinter.contract_id == LeaseContract.id
                ).filter(
                    and_(
                        ContractPrinter.printer_id == printer.id,
                        LeaseContract.status == "active"
                    )
                ).first()
                
                if contract_printer:
                    reading_contract_id = contract_printer.contract_id
                else:
                    results["errors"].append({
                        "printer_id": printer.id,
                        "ip_address": printer.ip,
                        "error": "No se encontró un contrato activo para esta impresora"
                    })
                    continue
            
            # Obtener la lectura anterior para calcular diferencias
            previous_reading = db.query(CounterReading).filter(
                CounterReading.printer_id == printer.id
            ).order_by(desc(CounterReading.reading_date)).first()
            
            # Calcular contadores actuales
            counter_bw_current = snmp_data.get('pages_printed_mono', 0)
            counter_color_current = snmp_data.get('pages_printed_color', 0)
            counter_total_current = counter_bw_current + counter_color_current
            
            # Crear la lectura
            reading = CounterReading(
                printer_id=printer.id,
                billing_period_id=period_id,
                reading_date=date.today(),
                counter_bw_current=counter_bw_current,
                counter_color_current=counter_color_current,
                counter_total_current=counter_total_current,
                location_snapshot=printer.location,
                reading_method="snmp_automatic",
                notes=f"Lectura automática SNMP - Estado: {snmp_data.get('status', 'unknown')}"
            )
            
            # Calcular diferencias con lectura anterior
            if previous_reading:
                reading.counter_bw_previous = previous_reading.counter_bw_current
                reading.counter_color_previous = previous_reading.counter_color_current
                reading.counter_total_previous = previous_reading.counter_total_current
                
                reading.prints_bw_period = max(0, counter_bw_current - previous_reading.counter_bw_current)
                reading.prints_color_period = max(0, counter_color_current - previous_reading.counter_color_current)
                reading.prints_total_period = max(0, counter_total_current - previous_reading.counter_total_current)
            else:
                # Primera lectura - usar contadores iniciales
                reading.counter_bw_previous = printer.initial_counter_bw or 0
                reading.counter_color_previous = printer.initial_counter_color or 0
                reading.counter_total_previous = printer.initial_counter_total or 0
                
                reading.prints_bw_period = max(0, counter_bw_current - (printer.initial_counter_bw or 0))
                reading.prints_color_period = max(0, counter_color_current - (printer.initial_counter_color or 0))
                reading.prints_total_period = max(0, counter_total_current - (printer.initial_counter_total or 0))
            
            db.add(reading)
            db.flush()  # Para obtener el ID
            
            results["success"].append({
                "printer_id": printer.id,
                "ip_address": printer.ip,
                "reading_id": reading.id,
                "counter_bw": counter_bw_current,
                "counter_color": counter_color_current,
                "counter_total": counter_total_current,
                "prints_bw_period": reading.prints_bw_period,
                "prints_color_period": reading.prints_color_period,
                "status": snmp_data.get('status', 'unknown')
            })
            
            results["successful_readings"] += 1
            
        except Exception as e:
            results["errors"].append({
                "printer_id": printer.id,
                "ip_address": printer.ip,
                "error": f"Error al procesar: {str(e)}"
            })
    
    db.commit()
    
    return {
        "message": f"Proceso completado: {results['successful_readings']}/{results['total_printers']} lecturas exitosas",
        "results": results
    }

@router.post("/readings/snmp-single/{printer_id}/{period_id}")
def create_snmp_single_reading(
    printer_id: int,
    period_id: int,
    db: Session = Depends(get_db)
):
    """Realizar lectura SNMP automática para una impresora específica"""
    
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impresora no encontrada"
        )
    
    # Verificar que el período existe
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    # Verificar si ya existe una lectura
    existing_reading = db.query(CounterReading).filter(
        and_(
            CounterReading.printer_id == printer_id,
            CounterReading.billing_period_id == period_id
        )
    ).first()
    
    if existing_reading:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una lectura para esta impresora en este período"
        )
    
    # Determinar el contrato activo de la impresora
    contract_printer = db.query(ContractPrinter).join(
        LeaseContract, ContractPrinter.contract_id == LeaseContract.id
    ).filter(
        and_(
            ContractPrinter.printer_id == printer_id,
            LeaseContract.status == "active"
        )
    ).first()
    
    if not contract_printer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró un contrato activo para esta impresora"
        )
    
    # Determinar el perfil SNMP
    profile = 'generic_v2c'
    if printer.brand:
        brand_lower = printer.brand.lower()
        if 'hp' in brand_lower:
            profile = 'hp'
        elif 'oki' in brand_lower:
            profile = 'oki'
        elif 'brother' in brand_lower:
            profile = 'brother'
        elif 'lexmark' in brand_lower:
            profile = 'lexmark'
        elif 'epson' in brand_lower:
            profile = 'epson'
        elif 'ricoh' in brand_lower:
            profile = 'ricoh'
    
    # Realizar consulta SNMP
    snmp_service = SNMPService()
    snmp_data = snmp_service.poll_printer(printer.ip, profile)
    
    if not snmp_data or snmp_data.get('status') == 'offline':
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo conectar con la impresora vía SNMP"
        )
    
    # Obtener la lectura anterior
    previous_reading = db.query(CounterReading).filter(
        CounterReading.printer_id == printer_id
    ).order_by(desc(CounterReading.reading_date)).first()
    
    # Calcular contadores actuales
    counter_bw_current = snmp_data.get('pages_printed_mono', 0)
    counter_color_current = snmp_data.get('pages_printed_color', 0)
    counter_total_current = counter_bw_current + counter_color_current
    
    # Crear la lectura
    reading = CounterReading(
        printer_id=printer_id,
        billing_period_id=period_id,
        reading_date=date.today(),
        counter_bw_current=counter_bw_current,
        counter_color_current=counter_color_current,
        counter_total_current=counter_total_current,
        location_snapshot=printer.location,
        reading_method="snmp_automatic",
        notes=f"Lectura automática SNMP - Estado: {snmp_data.get('status', 'unknown')}"
    )
    
    # Calcular diferencias
    if previous_reading:
        reading.counter_bw_previous = previous_reading.counter_bw_current
        reading.counter_color_previous = previous_reading.counter_color_current
        reading.counter_total_previous = previous_reading.counter_total_current
        
        reading.prints_bw_period = max(0, counter_bw_current - previous_reading.counter_bw_current)
        reading.prints_color_period = max(0, counter_color_current - previous_reading.counter_color_current)
        reading.prints_total_period = max(0, counter_total_current - previous_reading.counter_total_current)
    else:
        reading.counter_bw_previous = printer.initial_counter_bw or 0
        reading.counter_color_previous = printer.initial_counter_color or 0
        reading.counter_total_previous = printer.initial_counter_total or 0
        
        reading.prints_bw_period = max(0, counter_bw_current - (printer.initial_counter_bw or 0))
        reading.prints_color_period = max(0, counter_color_current - (printer.initial_counter_color or 0))
        reading.prints_total_period = max(0, counter_total_current - (printer.initial_counter_total or 0))
    
    db.add(reading)
    db.commit()
    db.refresh(reading)
    
    return {
        "message": "Lectura SNMP automática creada exitosamente",
        "reading": reading,
        "snmp_data": {
            "status": snmp_data.get('status'),
            "toner_levels": {
                "black": snmp_data.get('toner_level_black'),
                "cyan": snmp_data.get('toner_level_cyan'),
                "magenta": snmp_data.get('toner_level_magenta'),
                "yellow": snmp_data.get('toner_level_yellow')
            },
            "paper_level": snmp_data.get('paper_level')
        }
    }

# SNMP READINGS ENDPOINTS

@router.post("/snmp-readings/{contract_id}")
def get_snmp_readings_for_contract(
    contract_id: int,
    period_id: int,
    db: Session = Depends(get_db)
):
    """Obtener lecturas SNMP automáticas para todas las impresoras de un contrato"""
    
    # Verificar que el contrato existe
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    # Verificar que el período existe
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    # Obtener impresoras del contrato
    contract_printers = db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract_id
    ).all()
    
    if not contract_printers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay impresoras asociadas a este contrato"
        )
    
    from ..services.snmp import SNMPService
    snmp_service = SNMPService()
    
    results = []
    errors = []
    
    for cp in contract_printers:
        try:
            printer = db.query(Printer).filter(Printer.id == cp.printer_id).first()
            if not printer or not printer.ip:
                errors.append(f"Impresora {cp.printer_id}: IP no configurada")
                continue

            if printer.ignore_counters:
                errors.append(f"Impresora {printer.ip}: configurada para ignorar contadores")
                continue
            
            # Obtener contadores SNMP
            counters = snmp_service.get_printer_counters(printer.ip)
            
            if counters:
                # Verificar si ya existe una lectura para este período
                existing_reading = db.query(CounterReading).filter(
                    and_(
                        CounterReading.printer_id == printer.id,
                        CounterReading.billing_period_id == period_id
                    )
                ).first()
                
                if existing_reading:
                    errors.append(f"Impresora {printer.ip}: Ya existe lectura para este período")
                    continue
                
                # Obtener lectura anterior
                previous_reading = db.query(CounterReading).filter(
                    CounterReading.printer_id == printer.id
                ).order_by(desc(CounterReading.reading_date)).first()
                
                # Crear nueva lectura
                new_reading = CounterReading(
                    printer_id=printer.id,
                    billing_period_id=period_id,
                    reading_date=date.today(),
                    counter_bw_current=counters.get('bw_total', 0),
                    counter_color_current=counters.get('color_total', 0),
                    counter_total_current=counters.get('total_pages', 0),
                    location_snapshot=printer.location,
                    reading_method="snmp_auto",
                    notes="Lectura automática vía SNMP"
                )
                
                if previous_reading:
                    new_reading.counter_bw_previous = previous_reading.counter_bw_current
                    new_reading.counter_color_previous = previous_reading.counter_color_current
                    new_reading.counter_total_previous = previous_reading.counter_total_current
                    
                    new_reading.prints_bw_period = max(0, new_reading.counter_bw_current - previous_reading.counter_bw_current)
                    new_reading.prints_color_period = max(0, new_reading.counter_color_current - previous_reading.counter_color_current)
                    new_reading.prints_total_period = max(0, new_reading.counter_total_current - previous_reading.counter_total_current)
                else:
                    new_reading.counter_bw_previous = printer.initial_counter_bw or 0
                    new_reading.counter_color_previous = printer.initial_counter_color or 0
                    new_reading.counter_total_previous = printer.initial_counter_total or 0
                    
                    new_reading.prints_bw_period = max(0, new_reading.counter_bw_current - (printer.initial_counter_bw or 0))
                    new_reading.prints_color_period = max(0, new_reading.counter_color_current - (printer.initial_counter_color or 0))
                    new_reading.prints_total_period = max(0, new_reading.counter_total_current - (printer.initial_counter_total or 0))
                
                db.add(new_reading)
                db.flush()
                
                results.append({
                    "printer_id": printer.id,
                    "printer_ip": printer.ip,
                    "reading_id": new_reading.id,
                    "counters": counters,
                    "prints_bw": new_reading.prints_bw_period,
                    "prints_color": new_reading.prints_color_period,
                    "prints_total": new_reading.prints_total_period
                })
            else:
                errors.append(f"Impresora {printer.ip}: No se pudieron obtener contadores SNMP")
                
        except Exception as e:
            errors.append(f"Impresora {cp.printer_id}: {str(e)}")
    
    if results:
        db.commit()
    
    return {
        "contract_id": contract_id,
        "period_id": period_id,
        "successful_readings": len(results),
        "total_printers": len(contract_printers),
        "results": results,
        "errors": errors
    }

@router.post("/snmp-readings/single/{printer_id}")
def get_snmp_reading_for_printer(
    printer_id: int,
    period_id: int,
    db: Session = Depends(get_db)
):
    """Obtener lectura SNMP para una impresora específica"""
    
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impresora no encontrada"
        )
    
    if not printer.ip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La impresora no tiene IP configurada"
        )
    
    # Verificar que el período existe
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período de facturación no encontrado"
        )
    
    # Verificar si ya existe una lectura para este período
    existing_reading = db.query(CounterReading).filter(
        and_(
            CounterReading.printer_id == printer_id,
            CounterReading.billing_period_id == period_id
        )
    ).first()
    
    if existing_reading:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una lectura para esta impresora en este período"
        )
    
    from ..services.snmp import SNMPService
    snmp_service = SNMPService()
    
    try:
        # Obtener contadores SNMP
        counters = snmp_service.get_printer_counters(printer.ip)
        
        if not counters:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No se pudieron obtener contadores SNMP de la impresora"
            )
        
        # Obtener lectura anterior
        previous_reading = db.query(CounterReading).filter(
            CounterReading.printer_id == printer_id
        ).order_by(desc(CounterReading.reading_date)).first()
        
        # Crear nueva lectura
        new_reading = CounterReading(
            printer_id=printer_id,
            billing_period_id=period_id,
            reading_date=date.today(),
            counter_bw_current=counters.get('bw_total', 0),
            counter_color_current=counters.get('color_total', 0),
            counter_total_current=counters.get('total_pages', 0),
            location_snapshot=printer.location,
            reading_method="snmp_auto",
            notes="Lectura automática vía SNMP"
        )
        
        if previous_reading:
            new_reading.counter_bw_previous = previous_reading.counter_bw_current
            new_reading.counter_color_previous = previous_reading.counter_color_current
            new_reading.counter_total_previous = previous_reading.counter_total_current
            
            new_reading.prints_bw_period = max(0, new_reading.counter_bw_current - previous_reading.counter_bw_current)
            new_reading.prints_color_period = max(0, new_reading.counter_color_current - previous_reading.counter_color_current)
            new_reading.prints_total_period = max(0, new_reading.counter_total_current - previous_reading.counter_total_current)
        else:
            new_reading.counter_bw_previous = printer.initial_counter_bw or 0
            new_reading.counter_color_previous = printer.initial_counter_color or 0
            new_reading.counter_total_previous = printer.initial_counter_total or 0
            
            new_reading.prints_bw_period = max(0, new_reading.counter_bw_current - (printer.initial_counter_bw or 0))
            new_reading.prints_color_period = max(0, new_reading.counter_color_current - (printer.initial_counter_color or 0))
            new_reading.prints_total_period = max(0, new_reading.counter_total_current - (printer.initial_counter_total or 0))
        
        db.add(new_reading)
        db.commit()
        db.refresh(new_reading)
        
        return {
            "printer_id": printer_id,
            "printer_ip": printer.ip,
            "reading_id": new_reading.id,
            "counters": counters,
            "prints_bw": new_reading.prints_bw_period,
            "prints_color": new_reading.prints_color_period,
            "prints_total": new_reading.prints_total_period
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo lecturas SNMP: {str(e)}"
        )

@router.get("/dashboard-metrics")
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Obtener métricas para el dashboard de facturación"""
    mode = billing_engine.ensure_default_deployment_config(db)
    labels = billing_engine.get_deployment_labels(mode)
    
    # Total de facturas
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    
    # Ingresos totales
    total_revenue = db.query(func.sum(Invoice.total_amount)).scalar() or 0
    
    # Facturas pendientes
    pending_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.status.in_(["draft", "generated", "sent"])
    ).scalar() or 0

    sent_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.email_delivery_status == "sent"
    ).scalar() or 0

    email_failed_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.email_delivery_status == "failed"
    ).scalar() or 0
    
    # Facturas vencidas
    overdue_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.status == "overdue"
    ).scalar() or 0
    
    # Períodos activos
    periods_count = db.query(func.count(BillingPeriod.id)).filter(
        BillingPeriod.status == "open"
    ).scalar() or 0
    
    # Contratos activos
    active_contracts = db.query(func.count(LeaseContract.id)).filter(
        LeaseContract.status == "active"
    ).scalar() or 0
    
    # Lecturas este mes
    from sqlalchemy import extract
    current_month = datetime.utcnow().month
    current_year = datetime.utcnow().year
    readings_this_month = db.query(func.count(CounterReading.id)).filter(
        and_(
            extract('month', CounterReading.reading_date) == current_month,
            extract('year', CounterReading.reading_date) == current_year
        )
    ).scalar() or 0
    
    # Ingresos por período (últimos 5 períodos)
    revenue_by_period_query = db.query(
        BillingPeriod.name,
        func.coalesce(func.sum(Invoice.total_amount), 0).label('revenue')
    ).outerjoin(
        Invoice, BillingPeriod.id == Invoice.billing_period_id
    ).group_by(
        BillingPeriod.id, BillingPeriod.name
    ).order_by(
        desc(BillingPeriod.start_date)
    ).limit(5).all()
    
    revenue_data = [
        {
            "period_name": period_name,
            "period": period_name,
            "revenue": float(revenue)
        }
        for period_name, revenue in revenue_by_period_query
    ]
    
    return {
        "deploymentMode": mode,
        "deploymentLabel": labels["mode_label"],
        "targetLabel": labels["target_label"],
        "documentLabel": labels["document_label"],
        "totalInvoices": total_invoices,
        "totalRevenue": float(total_revenue),
        "pendingInvoices": pending_invoices,
        "sentInvoices": sent_invoices,
        "emailFailedInvoices": email_failed_invoices,
        "overdueInvoices": overdue_invoices,
        "periodsCount": periods_count,
        "activeContracts": active_contracts,
        "readingsThisMonth": readings_this_month,
        "revenueByPeriod": revenue_data
    }

# PDF GENERATION ENDPOINTS

@router.get("/invoices/{invoice_id}/pdf")
def generate_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db)
):
    """Generar PDF de una factura específica"""
    from fastapi.responses import Response
    from ..services.pdf_service import PDFService
    
    # Obtener datos de la factura
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    # Obtener datos relacionados
    contract = db.query(LeaseContract).filter(LeaseContract.id == invoice.contract_id).first()
    period = db.query(BillingPeriod).filter(BillingPeriod.id == invoice.billing_period_id).first()
    lines = db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice_id).all()
    
    # Preparar datos para el PDF
    invoice_data = {
        'invoice_number': invoice.invoice_number,
        'invoice_date': invoice.invoice_date,
        'due_date': invoice.due_date,
        'period_start': invoice.period_start,
        'period_end': invoice.period_end,
        'subtotal': invoice.subtotal,
        'tax_amount': invoice.tax_amount,
        'total_amount': invoice.total_amount,
        'tax_rate': invoice.tax_rate,
        'status': invoice.status,
        'notes': invoice.notes
    }
    
    contract_data = {
        'contract_number': contract.contract_number,
        'contract_name': contract.contract_name,
        'supplier': contract.supplier,
        'contract_type': contract.contract_type
    } if contract else {}
    
    period_data = {
        'name': period.name,
        'start_date': period.start_date,
        'end_date': period.end_date
    } if period else {}
    
    lines_data = [
        {
            'description': line.description,
            'quantity': line.quantity,
            'unit_price': line.unit_price,
            'line_total': line.line_total
        }
        for line in lines
    ]
    
    # Generar PDF
    try:
        pdf_service = PDFService()
        pdf_buffer = pdf_service.generate_invoice_pdf(
            invoice_data, contract_data, lines_data, period_data
        )
        
        # Retornar el PDF como respuesta
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=factura_{invoice.invoice_number}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando PDF: {str(e)}"
        )

@router.get("/periods/{period_id}/report-pdf")
def generate_period_report_pdf(
    period_id: int,
    db: Session = Depends(get_db)
):
    """Generar PDF de reporte de período"""
    from fastapi.responses import Response
    from ..services.pdf_service import PDFService
    
    # Obtener datos del período
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período no encontrado"
        )
    
    # Obtener facturas del período
    invoices = db.query(Invoice).filter(
        Invoice.billing_period_id == period_id
    ).order_by(Invoice.invoice_date.desc()).all()
    
    # Calcular resumen financiero
    total_amount = sum(float(inv.total_amount) for inv in invoices)
    paid_amount = sum(float(inv.total_amount) for inv in invoices if inv.status == 'paid')
    pending_amount = sum(float(inv.total_amount) for inv in invoices if inv.status in ['draft', 'sent'])
    overdue_amount = sum(float(inv.total_amount) for inv in invoices if inv.status == 'overdue')
    
    # Preparar datos para el PDF
    period_data = {
        'name': period.name,
        'start_date': period.start_date,
        'end_date': period.end_date,
        'cut_off_date': period.cut_off_date,
        'status': period.status
    }
    
    invoices_data = [
        {
            'invoice_number': inv.invoice_number,
            'contract_id': inv.contract_id,
            'invoice_date': inv.invoice_date,
            'total_amount': inv.total_amount,
            'status': inv.status
        }
        for inv in invoices
    ]
    
    summary_data = {
        'total_amount': total_amount,
        'paid_amount': paid_amount,
        'pending_amount': pending_amount,
        'overdue_amount': overdue_amount
    }
    
    # Generar PDF
    try:
        pdf_service = PDFService()
        pdf_buffer = pdf_service.generate_period_report_pdf(
            period_data, invoices_data, summary_data
        )
        
        # Retornar el PDF como respuesta
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=reporte_{period.name.replace(' ', '_')}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando PDF: {str(e)}"
        )

# EXPORT TO EXCEL/CSV ENDPOINTS

@router.get("/export/invoices-excel")
def export_invoices_excel(
    period_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Exportar facturas a Excel"""
    from fastapi.responses import Response
    from ..services.export_service import ExportService
    
    # Query base
    query = db.query(Invoice)
    
    # Filtros
    if period_id:
        query = query.filter(Invoice.billing_period_id == period_id)
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    
    invoices = query.order_by(Invoice.invoice_date.desc()).all()
    
    # Preparar datos con información de contratos
    invoices_data = []
    for invoice in invoices:
        contract = db.query(LeaseContract).filter(LeaseContract.id == invoice.contract_id).first()
        period = db.query(BillingPeriod).filter(BillingPeriod.id == invoice.billing_period_id).first()
        
        invoice_dict = {
            'invoice_number': invoice.invoice_number,
            'contract_id': invoice.contract_id,
            'contract_number': contract.contract_number if contract else '',
            'contract_name': contract.contract_name if contract else '',
            'supplier': contract.supplier if contract else '',
            'invoice_date': invoice.invoice_date.strftime('%Y-%m-%d') if invoice.invoice_date else '',
            'due_date': invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else '',
            'period_start': invoice.period_start.strftime('%Y-%m-%d') if invoice.period_start else '',
            'period_end': invoice.period_end.strftime('%Y-%m-%d') if invoice.period_end else '',
            'subtotal': float(invoice.subtotal),
            'tax_amount': float(invoice.tax_amount),
            'total_amount': float(invoice.total_amount),
            'status': invoice.status,
            'currency': invoice.currency,
            'tax_rate': float(invoice.tax_rate),
            'notes': invoice.notes or ''
        }
        invoices_data.append(invoice_dict)
    
    # Obtener nombre del período si se filtró por período
    period_name = None
    if period_id:
        period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
        period_name = period.name if period else None
    
    try:
        export_service = ExportService()
        excel_buffer = export_service.export_invoices_to_excel(invoices_data, period_name)
        
        filename = f"facturas{'_' + period_name.replace(' ', '_') if period_name else ''}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exportando a Excel: {str(e)}"
        )

@router.get("/export/readings-excel")
def export_readings_excel(
    period_id: Optional[int] = Query(None),
    contract_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Exportar lecturas de contadores a Excel"""
    from fastapi.responses import Response
    from ..services.export_service import ExportService
    
    # Query base
    query = db.query(CounterReading)
    
    # Filtros
    if period_id:
        query = query.filter(CounterReading.billing_period_id == period_id)
    if contract_id:
        # Filtrar por impresoras del contrato
        contract_printers = db.query(ContractPrinter).filter(
            ContractPrinter.contract_id == contract_id
        ).all()
        printer_ids = [cp.printer_id for cp in contract_printers]
        query = query.filter(CounterReading.printer_id.in_(printer_ids))
    
    readings = query.order_by(CounterReading.reading_date.desc()).all()
    
    # Preparar datos con información adicional
    readings_data = []
    for reading in readings:
        printer = db.query(Printer).filter(Printer.id == reading.printer_id).first()
        
        # Buscar contrato de la impresora
        contract_printer = db.query(ContractPrinter).filter(
            ContractPrinter.printer_id == reading.printer_id
        ).first()
        contract = None
        if contract_printer:
            contract = db.query(LeaseContract).filter(
                LeaseContract.id == contract_printer.contract_id
            ).first()
        
        reading_dict = {
            'printer_id': reading.printer_id,
            'printer_ip': printer.ip if printer else '',
            'printer_location': reading.location_snapshot or (printer.location if printer else ''),
            'contract_id': contract.id if contract else '',
            'contract_name': contract.contract_name if contract else '',
            'reading_date': reading.reading_date.strftime('%Y-%m-%d') if reading.reading_date else '',
            'counter_bw_current': reading.counter_bw_current,
            'counter_color_current': reading.counter_color_current,
            'counter_total_current': reading.counter_total_current,
            'counter_bw_previous': reading.counter_bw_previous,
            'counter_color_previous': reading.counter_color_previous,
            'counter_total_previous': reading.counter_total_previous,
            'prints_bw_period': reading.prints_bw_period,
            'prints_color_period': reading.prints_color_period,
            'prints_total_period': reading.prints_total_period,
            'reading_method': reading.reading_method,
            'notes': reading.notes or ''
        }
        readings_data.append(reading_dict)
    
    # Obtener nombre del período si se filtró por período
    period_name = None
    if period_id:
        period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
        period_name = period.name if period else None
    
    try:
        export_service = ExportService()
        excel_buffer = export_service.export_readings_to_excel(readings_data, period_name)
        
        filename = f"lecturas{'_' + period_name.replace(' ', '_') if period_name else ''}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exportando a Excel: {str(e)}"
        )

@router.get("/export/invoices-csv")
def export_invoices_csv(
    period_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Exportar facturas a CSV"""
    from fastapi.responses import Response
    from ..services.export_service import ExportService
    
    # Usar la misma lógica que el Excel pero exportar a CSV
    query = db.query(Invoice)
    
    if period_id:
        query = query.filter(Invoice.billing_period_id == period_id)
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    
    invoices = query.order_by(Invoice.invoice_date.desc()).all()
    
    invoices_data = []
    for invoice in invoices:
        contract = db.query(LeaseContract).filter(LeaseContract.id == invoice.contract_id).first()
        
        invoice_dict = {
            'invoice_number': invoice.invoice_number,
            'contract_id': invoice.contract_id,
            'invoice_date': invoice.invoice_date.strftime('%Y-%m-%d') if invoice.invoice_date else '',
            'due_date': invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else '',
            'total_amount': float(invoice.total_amount),
            'status': invoice.status,
            'currency': invoice.currency,
            'contract_name': contract.contract_name if contract else ''
        }
        invoices_data.append(invoice_dict)
    
    try:
        export_service = ExportService()
        csv_buffer = export_service.export_invoices_to_csv(invoices_data)
        
        filename = f"facturas_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exportando a CSV: {str(e)}"
        )

@router.get("/export/financial-summary")
def export_financial_summary(
    db: Session = Depends(get_db)
):
    """Exportar resumen financiero a Excel"""
    from fastapi.responses import Response
    from ..services.export_service import ExportService
    
    # Obtener métricas del dashboard
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    total_revenue = db.query(func.sum(Invoice.total_amount)).scalar() or 0
    paid_invoices = db.query(func.count(Invoice.id)).filter(Invoice.status == "paid").scalar() or 0
    pending_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.status.in_(["draft", "sent"])
    ).scalar() or 0
    overdue_invoices = db.query(func.count(Invoice.id)).filter(Invoice.status == "overdue").scalar() or 0
    active_periods = db.query(func.count(BillingPeriod.id)).filter(
        BillingPeriod.status == "open"
    ).scalar() or 0
    active_contracts = db.query(func.count(LeaseContract.id)).filter(
        LeaseContract.status == "active"
    ).scalar() or 0
    
    summary_data = {
        'total_invoices': total_invoices,
        'total_revenue': float(total_revenue),
        'paid_invoices': paid_invoices,
        'pending_invoices': pending_invoices,
        'overdue_invoices': overdue_invoices,
        'active_periods': active_periods,
        'active_contracts': active_contracts
    }
    
    try:
        export_service = ExportService()
        excel_buffer = export_service.export_financial_summary_to_excel(summary_data)
        
        filename = f"resumen_financiero_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exportando resumen: {str(e)}"
        )