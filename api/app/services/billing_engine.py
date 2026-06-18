from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from app.models import (
    BillingConfiguration,
    BillingEmailLog,
    BillingPeriod,
    BillingTarget,
    ContractPrinter,
    CounterReading,
    Invoice,
    InvoiceLine,
    LeaseContract,
    MonthlyCounter,
    Printer,
)
from app.services.email_service import EmailService


DEPLOYMENT_INTERNAL = "internal_customer"
DEPLOYMENT_PROVIDER = "service_provider"


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_period_usage_from_monthly_counters(db: Session, printer_id: int, period: BillingPeriod) -> Optional[Dict]:
    period_end_exclusive = period.end_date + timedelta(days=1)
    monthly_counters = db.query(MonthlyCounter).filter(
        and_(
            MonthlyCounter.printer_id == printer_id,
            MonthlyCounter.recorded_at >= period.start_date,
            MonthlyCounter.recorded_at < period_end_exclusive,
        )
    ).order_by(MonthlyCounter.recorded_at.asc(), MonthlyCounter.id.asc()).all()

    if not monthly_counters:
        monthly_counters = db.query(MonthlyCounter).filter(
            and_(
                MonthlyCounter.printer_id == printer_id,
                MonthlyCounter.year == period.start_date.year,
                MonthlyCounter.month == period.start_date.month,
            )
        ).order_by(MonthlyCounter.recorded_at.asc(), MonthlyCounter.id.asc()).all()

    if not monthly_counters:
        return None

    latest_counter = monthly_counters[-1]
    return {
        "id": -latest_counter.id,
        "printer_id": printer_id,
        "billing_period_id": period.id,
        "reading_date": latest_counter.recorded_at.date(),
        "counter_bw_current": latest_counter.counter_bw or 0,
        "counter_color_current": latest_counter.counter_color or 0,
        "counter_total_current": latest_counter.counter_total or 0,
        "counter_bw_previous": monthly_counters[0].previous_counter_bw or 0,
        "counter_color_previous": monthly_counters[0].previous_counter_color or 0,
        "counter_total_previous": monthly_counters[0].previous_counter_total or 0,
        "prints_bw_period": sum(counter.pages_printed_bw or 0 for counter in monthly_counters),
        "prints_color_period": sum(counter.pages_printed_color or 0 for counter in monthly_counters),
        "prints_total_period": sum(counter.pages_printed_total or 0 for counter in monthly_counters),
        "location_snapshot": latest_counter.location_snapshot,
        "reading_method": "monthly_counter",
        "notes": "Lectura derivada desde contadores mensuales",
        "created_at": latest_counter.created_at,
    }


def get_period_counter_usage(db: Session, printer_id: int, period: BillingPeriod):
    reading = db.query(CounterReading).filter(
        and_(
            CounterReading.printer_id == printer_id,
            CounterReading.billing_period_id == period.id,
        )
    ).first()
    if reading:
        return reading

    return get_period_usage_from_monthly_counters(db, printer_id, period)


def usage_value(usage, field: str, default=0):
    if isinstance(usage, dict):
        return usage.get(field, default)
    return getattr(usage, field, default)


def get_config_value(db: Session, key: str, default: str = "") -> str:
    config = db.query(BillingConfiguration).filter(BillingConfiguration.key == key).first()
    return config.value if config else default


def set_config_value(db: Session, key: str, value: str, description: str = "", data_type: str = "string"):
    config = db.query(BillingConfiguration).filter(BillingConfiguration.key == key).first()
    if config:
        config.value = value
        config.description = description or config.description
        config.data_type = data_type or config.data_type
    else:
        db.add(BillingConfiguration(
            key=key,
            value=value,
            description=description,
            data_type=data_type,
        ))


def get_deployment_mode(db: Session) -> str:
    mode = get_config_value(db, "deployment_mode", DEPLOYMENT_INTERNAL)
    if mode not in (DEPLOYMENT_INTERNAL, DEPLOYMENT_PROVIDER):
        return DEPLOYMENT_INTERNAL
    return mode


def get_deployment_labels(mode: str) -> Dict[str, str]:
    if mode == DEPLOYMENT_PROVIDER:
        return {
            "mode_label": "Proveedor de servicio",
            "target_label": "Cliente",
            "document_label": "Factura",
            "target_type": "external_customer",
        }

    return {
        "mode_label": "Cliente interno",
        "target_label": "Area / centro de costo",
        "document_label": "Liquidacion interna",
        "target_type": "internal_area",
    }


def ensure_default_deployment_config(db: Session) -> str:
    mode = get_deployment_mode(db)
    set_config_value(
        db,
        "deployment_mode",
        mode,
        "Modo de instalacion: internal_customer o service_provider",
    )
    set_config_value(db, "digital_invoice_enabled", "false", "Conexion a factura digital reservada para version 2", "boolean")
    set_config_value(db, "digital_invoice_provider", "pending", "Proveedor de factura digital pendiente", "string")
    return mode


def _target_identity_for_contract(contract: LeaseContract, mode: str) -> Tuple[str, str, Optional[str]]:
    if mode == DEPLOYMENT_PROVIDER:
        return (
            contract.supplier or contract.contract_name,
            "external_customer",
            contract.contact_email,
        )

    name = contract.cost_center or contract.department or contract.contract_name
    return (
        name,
        "internal_area",
        contract.contact_email,
    )


def resolve_billing_target(db: Session, contract: LeaseContract, mode: Optional[str] = None) -> BillingTarget:
    mode = mode or get_deployment_mode(db)

    if contract.billing_target_id:
        existing = db.query(BillingTarget).filter(BillingTarget.id == contract.billing_target_id).first()
        if existing:
            return existing

    target_name, target_type, email = _target_identity_for_contract(contract, mode)
    query = db.query(BillingTarget).filter(
        BillingTarget.target_type == target_type,
        BillingTarget.name == target_name,
    )
    if contract.cost_center:
        query = query.filter(BillingTarget.cost_center_code == contract.cost_center)

    target = query.first()
    if not target:
        target = BillingTarget(
            name=target_name,
            target_type=target_type,
            billing_email=email,
            contact_name=contract.contact_person,
            cost_center_code=contract.cost_center,
            source_type="contract",
            source_id=contract.id,
            notes="Creado automaticamente desde el motor de facturacion",
        )
        db.add(target)
        db.flush()
    elif email and not target.billing_email:
        target.billing_email = email

    contract.billing_target_id = target.id
    return target


def generate_invoice_number(db: Session, mode: str, status: str = "draft") -> str:
    prefix_default = "LIQ-" if mode == DEPLOYMENT_INTERNAL else "FAC-"
    if status == "draft":
        prefix_default = "BOR-" if mode == DEPLOYMENT_INTERNAL else "DRAFT-"

    prefix = get_config_value(db, "invoice_prefix", prefix_default)
    last_invoice = db.query(Invoice).order_by(desc(Invoice.id)).first()
    next_number = (last_invoice.id + 1) if last_invoice else 1
    return f"{prefix}{next_number:06d}"


def build_invoice_lines(db: Session, invoice: Invoice, contract: LeaseContract, period: BillingPeriod) -> Decimal:
    total_amount = Decimal("0.00")
    contract_printers = db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract.id,
        ContractPrinter.is_active == True,
    ).all()

    if contract.contract_type in ("monthly_fixed", "fixed_cost_per_quantity") and contract.fixed_monthly_cost:
        line_total = money(contract.fixed_monthly_cost)
        db.add(InvoiceLine(
            invoice_id=invoice.id,
            description=f"Cargo fijo mensual - {period.name}",
            item_type="fixed_cost",
            quantity=1,
            unit_price=float(line_total),
            line_total=float(line_total),
        ))
        total_amount += line_total

    if contract.contract_type == "annual_fixed" and contract.fixed_annual_cost:
        line_total = money(Decimal(str(contract.fixed_annual_cost)) / Decimal("12"))
        db.add(InvoiceLine(
            invoice_id=invoice.id,
            description=f"Prorrateo mensual de cargo anual - {period.name}",
            item_type="fixed_cost",
            quantity=1,
            unit_price=float(line_total),
            line_total=float(line_total),
        ))
        total_amount += line_total

    if contract.contract_type in ("cost_per_copy", "fixed_cost_per_quantity"):
        total_bw = 0
        total_color = 0
        missing_readings: List[str] = []

        for contract_printer in contract_printers:
            reading = get_period_counter_usage(db, contract_printer.printer_id, period)

            printer = db.query(Printer).filter(Printer.id == contract_printer.printer_id).first()
            printer_label = f"{printer.brand} {printer.model} ({printer.asset_tag})" if printer else f"Equipo {contract_printer.printer_id}"

            if not reading:
                missing_readings.append(printer_label)
                continue

            total_bw += usage_value(reading, "prints_bw_period") or 0
            total_color += usage_value(reading, "prints_color_period") or 0

        billable_bw = total_bw
        billable_color = total_color
        bw_rate = money(contract.cost_bw_per_copy)
        color_rate = money(contract.cost_color_per_copy)

        if contract.contract_type == "fixed_cost_per_quantity":
            billable_bw = max(0, total_bw - (contract.included_copies_bw or 0))
            billable_color = max(0, total_color - (contract.included_copies_color or 0))
            bw_rate = money(contract.overage_cost_bw or contract.cost_bw_per_copy)
            color_rate = money(contract.overage_cost_color or contract.cost_color_per_copy)

        if billable_bw > 0:
            line_total = money(Decimal(billable_bw) * bw_rate)
            db.add(InvoiceLine(
                invoice_id=invoice.id,
                description=f"Copias B/N facturables - {period.name}",
                item_type="copies_bw",
                quantity=billable_bw,
                unit_price=float(bw_rate),
                line_total=float(line_total),
                period_info=f'{{"total_bw": {total_bw}, "included_bw": {contract.included_copies_bw or 0}}}',
            ))
            total_amount += line_total

        if billable_color > 0:
            line_total = money(Decimal(billable_color) * color_rate)
            db.add(InvoiceLine(
                invoice_id=invoice.id,
                description=f"Copias color facturables - {period.name}",
                item_type="copies_color",
                quantity=billable_color,
                unit_price=float(color_rate),
                line_total=float(line_total),
                period_info=f'{{"total_color": {total_color}, "included_color": {contract.included_copies_color or 0}}}',
            ))
            total_amount += line_total

        if missing_readings:
            raise ValueError("No hay registro de contadores del periodo para: " + ", ".join(missing_readings))

    return total_amount


def create_invoice(
    db: Session,
    period_id: int,
    contract_id: int,
    invoice_status: str = "draft",
    send_email: bool = False,
    recipient_email: Optional[str] = None,
    notes: Optional[str] = None,
    created_by: Optional[str] = None,
) -> Invoice:
    ensure_default_deployment_config(db)
    mode = get_deployment_mode(db)
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()

    if not period:
        raise ValueError("Periodo de facturacion no encontrado")
    if not contract:
        raise ValueError("Contrato no encontrado")
    if contract.status != "active":
        raise ValueError("Solo se pueden facturar contratos activos")

    target = resolve_billing_target(db, contract, mode)
    existing_invoice = db.query(Invoice).filter(
        Invoice.contract_id == contract_id,
        Invoice.billing_period_id == period_id,
        Invoice.billing_target_id == target.id,
        Invoice.status != "cancelled",
    ).first()
    tax_rate = money(get_config_value(db, "default_tax_rate", "21.00"))
    due_days = int(get_config_value(db, "due_days", "30") or "30")
    resolved_recipient = recipient_email or target.billing_email or contract.contact_email

    if existing_invoice:
        line_count = db.query(InvoiceLine).filter(InvoiceLine.invoice_id == existing_invoice.id).count()
        should_rebuild_draft = (
            existing_invoice.status == "draft"
            and (money(existing_invoice.total_amount) == Decimal("0.00") or line_count == 0)
        )

        if not should_rebuild_draft:
            return existing_invoice

        db.query(InvoiceLine).filter(InvoiceLine.invoice_id == existing_invoice.id).delete(synchronize_session=False)
        db.flush()

        existing_invoice.deployment_mode = mode
        existing_invoice.document_type = "internal_liquidation" if mode == DEPLOYMENT_INTERNAL else "customer_invoice"
        existing_invoice.recipient_name = target.name
        existing_invoice.recipient_email = resolved_recipient
        existing_invoice.currency = contract.currency or get_config_value(db, "currency", "ARS")
        existing_invoice.tax_rate = float(tax_rate)
        existing_invoice.notes = notes or existing_invoice.notes
        existing_invoice.created_by = created_by or existing_invoice.created_by

        subtotal = build_invoice_lines(db, existing_invoice, contract, period)
        existing_invoice.subtotal = float(subtotal)
        existing_invoice.tax_amount = float(money(subtotal * (tax_rate / Decimal("100"))))
        existing_invoice.total_amount = float(money(Decimal(str(existing_invoice.subtotal)) + Decimal(str(existing_invoice.tax_amount))))

        if send_email:
            send_invoice_email(db, existing_invoice)

        return existing_invoice

    invoice = Invoice(
        invoice_number=generate_invoice_number(db, mode, invoice_status),
        contract_id=contract.id,
        billing_period_id=period.id,
        billing_target_id=target.id,
        deployment_mode=mode,
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=due_days),
        period_start=period.start_date,
        period_end=period.end_date,
        status=invoice_status,
        document_type="internal_liquidation" if mode == DEPLOYMENT_INTERNAL else "customer_invoice",
        recipient_name=target.name,
        recipient_email=resolved_recipient,
        currency=contract.currency or get_config_value(db, "currency", "ARS"),
        tax_rate=float(tax_rate),
        notes=notes,
        created_by=created_by,
        digital_invoice_status="pending_v2",
        digital_invoice_provider=get_config_value(db, "digital_invoice_provider", "pending"),
        digital_invoice_payload="{}",
    )
    db.add(invoice)
    db.flush()

    subtotal = build_invoice_lines(db, invoice, contract, period)
    invoice.subtotal = float(subtotal)
    invoice.tax_amount = float(money(subtotal * (tax_rate / Decimal("100"))))
    invoice.total_amount = float(money(Decimal(str(invoice.subtotal)) + Decimal(str(invoice.tax_amount))))

    if send_email:
        send_invoice_email(db, invoice)

    return invoice


def build_invoice_email(invoice: Invoice, contract: LeaseContract, period: BillingPeriod) -> Tuple[str, str, str]:
    document_label = "Liquidacion interna" if invoice.deployment_mode == DEPLOYMENT_INTERNAL else "Factura"
    subject = f"{document_label} {invoice.invoice_number} - {period.name}"
    body = (
        f"Hola,\n\n"
        f"Se genero {document_label.lower()} {invoice.invoice_number} correspondiente al periodo {period.name}.\n"
        f"Contrato: {contract.contract_number}\n"
        f"Total: {invoice.currency} {invoice.total_amount:.2f}\n\n"
        "Este envio se registra desde Printer Fleet Manager.\n"
    )
    html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #111827;">
  <h2>{document_label} {invoice.invoice_number}</h2>
  <p>Periodo: <strong>{period.name}</strong></p>
  <p>Contrato: <strong>{contract.contract_number}</strong></p>
  <p>Destino: <strong>{invoice.recipient_name or ''}</strong></p>
  <p>Total: <strong>{invoice.currency} {invoice.total_amount:.2f}</strong></p>
  <p style="color:#6b7280;font-size:12px;">Preparado para conexion de factura digital en version 2.</p>
</body></html>
"""
    return subject, body, html_body


def send_invoice_email(db: Session, invoice: Invoice, recipient_email: Optional[str] = None) -> bool:
    delivery_email = recipient_email or invoice.recipient_email

    if not delivery_email:
        invoice.email_delivery_status = "missing_recipient"
        invoice.email_error = "La factura no tiene destinatario de email definido"
        db.add(BillingEmailLog(
            invoice_id=invoice.id,
            recipient_email="",
            subject=f"Factura {invoice.invoice_number}",
            status="missing_recipient",
            error_message=invoice.email_error,
        ))
        return False

    contract = db.query(LeaseContract).filter(LeaseContract.id == invoice.contract_id).first()
    period = db.query(BillingPeriod).filter(BillingPeriod.id == invoice.billing_period_id).first()
    subject, body, html_body = build_invoice_email(invoice, contract, period)
    send_result = EmailService.send_email_detailed(
        db=db,
        to_email=delivery_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )
    error_message = None if send_result.success else ": ".join(
        part for part in [send_result.message, send_result.error_detail] if part
    )
    log = BillingEmailLog(
        invoice_id=invoice.id,
        recipient_email=delivery_email,
        subject=subject,
        status="sent" if send_result.success else "failed",
        error_message=error_message,
        sent_at=datetime.utcnow() if send_result.success else None,
    )
    db.add(log)

    if send_result.success:
        invoice.status = "sent"
        invoice.sent_at = datetime.utcnow()
        invoice.email_delivery_status = "sent"
        invoice.email_error = None
    else:
        invoice.email_delivery_status = "failed"
        invoice.email_error = error_message or "SMTP no configurado o fallo el envio"

    return send_result.success