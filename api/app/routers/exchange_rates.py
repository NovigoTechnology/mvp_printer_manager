from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import requests
import json
import asyncio
import aiohttp

from ..db import get_db
from ..models import ExchangeRate, ExchangeRateSource

router = APIRouter()

class ExchangeRateCreate(BaseModel):
    date: datetime
    base_currency: str = "ARS"
    target_currency: str = "USD"
    rate: float
    source: str = "manual"
    source_url: Optional[str] = None
    bid_rate: Optional[float] = None
    ask_rate: Optional[float] = None
    is_manual_override: bool = False
    confidence_level: float = 1.0
    notes: Optional[str] = None
    created_by: Optional[str] = None

class ExchangeRateResponse(BaseModel):
    id: int
    date: datetime
    base_currency: str
    target_currency: str
    rate: float
    source: str
    source_url: Optional[str]
    bid_rate: Optional[float]
    ask_rate: Optional[float]
    is_active: bool
    is_manual_override: bool
    confidence_level: float
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class ExchangeRateSourceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    api_url: Optional[str]
    base_currency: str
    target_currency: str
    update_frequency_hours: int
    is_active: bool
    priority: int
    last_successful_update: Optional[datetime]
    last_error: Optional[str]
    success_count: int
    error_count: int
    
    class Config:
        from_attributes = True

@router.get("/current")
def get_current_exchange_rate(
    base_currency: str = "ARS",
    target_currency: str = "USD",
    db: Session = Depends(get_db)
):
    """Obtener la tasa de cambio más reciente"""
    
    # Buscar la tasa más reciente para el par de monedas (en cualquier dirección)
    rate = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == base_currency,
            ExchangeRate.target_currency == target_currency,
            ExchangeRate.is_active == True
        )
    ).order_by(desc(ExchangeRate.date)).first()
    
    # Si no encuentra, buscar en la dirección inversa
    rate_inverse = None
    if not rate:
        rate_inverse = db.query(ExchangeRate).filter(
            and_(
                ExchangeRate.base_currency == target_currency,
                ExchangeRate.target_currency == base_currency,
                ExchangeRate.is_active == True
            )
        ).order_by(desc(ExchangeRate.date)).first()
    
    if not rate and not rate_inverse:
        # Si no hay tasa, devolver valores por defecto
        if base_currency == "ARS" and target_currency == "USD":
            return {
                "dolar_venta": 0.0011,           # Venta de dólares: cuántos USD por 1 ARS
                "dolar_compra": 900.0,           # Compra de dólares: cuántos ARS por 1 USD  
                "ARS_to_USD": 0.0011,           # Mantener compatibilidad
                "USD_to_ARS": 900.0,            # Mantener compatibilidad
                "date": datetime.now().date().isoformat(),
                "source": "default",
                "last_updated": datetime.now().isoformat(),
                "message": "No hay tasas de cambio registradas. Usando valores por defecto."
            }
    
    # Usar la tasa encontrada (directa o inversa)
    if rate_inverse:
        # Tenemos USD→ARS, necesitamos convertir para ARS→USD
        actual_rate = 1 / rate_inverse.rate if rate_inverse.rate > 0 else 0
        rate_obj = rate_inverse
        inverted = True
    else:
        actual_rate = rate.rate
        rate_obj = rate
        inverted = False
    
    # Calcular tasa inversa
    inverse_rate = 1 / actual_rate if actual_rate > 0 else 0
    
    # IMPORTANTE: Los valores en DB pueden venir de APIs argentinas que dan "precio del dólar"
    # Necesitamos asegurar la interpretación correcta:
    
    if base_currency == "ARS" and target_currency == "USD":
        if inverted:
            # Tenemos USD→ARS (ej: 1435 ARS por USD), necesitamos ARS→USD
            dolar_compra = rate_obj.rate       # USD→ARS: cuántos ARS por 1 USD
            dolar_venta = actual_rate          # ARS→USD: cuántos USD por 1 ARS (1/1435)
        elif actual_rate > 100:
            # Es precio del dólar (ej: $1445 pesos por dólar)  
            dolar_compra = actual_rate         # Cuántos ARS necesitas por 1 USD
            dolar_venta = 1 / actual_rate      # Cuántos USD obtienes por 1 ARS
        else:
            # Es tasa ARS→USD (ej: 0.0007 USD por peso)
            dolar_venta = actual_rate          # Cuántos USD obtienes por 1 ARS  
            dolar_compra = inverse_rate        # Cuántos ARS necesitas por 1 USD
    else:
        dolar_venta = inverse_rate
        dolar_compra = actual_rate
    
    return {
        # Nombres descriptivos principales
        "dolar_venta": dolar_venta,       # Venta de dólares (ARS → USD)
        "dolar_compra": dolar_compra,     # Compra de dólares (USD → ARS)
        
        # Mantener compatibilidad con nombres anteriores (usar valores corregidos)
        "ARS_to_USD": dolar_venta,      # Usar el valor interpretado correctamente
        "USD_to_ARS": dolar_compra,     # Usar el valor interpretado correctamente
        
        # Metadatos
        "date": rate_obj.date.date().isoformat() if hasattr(rate_obj.date, 'date') else rate_obj.date.isoformat(),
        "source": rate_obj.source,
        "last_updated": rate_obj.created_at.isoformat(),
        "confidence_level": rate_obj.confidence_level,
        "is_manual_override": rate_obj.is_manual_override
    }

@router.get("/history")
def get_exchange_rate_history(
    base_currency: str = "ARS",
    target_currency: str = "USD",
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Obtener histórico de tasas de cambio"""
    
    start_date = datetime.now() - timedelta(days=days)
    
    # Buscar tasas en la dirección solicitada
    rates = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == base_currency,
            ExchangeRate.target_currency == target_currency,
            ExchangeRate.date >= start_date,
            ExchangeRate.is_active == True
        )
    ).order_by(desc(ExchangeRate.date)).all()
    
    # Buscar también en la dirección inversa
    rates_inverse = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == target_currency,
            ExchangeRate.target_currency == base_currency,
            ExchangeRate.date >= start_date,
            ExchangeRate.is_active == True
        )
    ).order_by(desc(ExchangeRate.date)).all()
    
    # Combinar y normalizar todas las tasas
    all_rates = []
    
    # Procesar tasas directas
    for rate in rates:
        all_rates.append({
            "id": rate.id,
            "date": rate.date.date().isoformat() if hasattr(rate.date, 'date') else rate.date.isoformat(),
            "rate": rate.rate,
            "display_rate": rate.rate if base_currency == "ARS" else (1 / rate.rate if rate.rate > 0 else 0),
            "source": rate.source,
            "is_manual_override": rate.is_manual_override,
            "confidence_level": rate.confidence_level,
            "notes": rate.notes,
            "created_by": rate.created_by,
            "created_at": rate.created_at.isoformat() if rate.created_at else None,
            "direction": "direct"
        })
    
    # Procesar tasas inversas (necesitan invertirse para mostrar correctamente)
    for rate in rates_inverse:
        inverted_rate = 1 / rate.rate if rate.rate > 0 else 0
        all_rates.append({
            "id": rate.id,
            "date": rate.date.date().isoformat() if hasattr(rate.date, 'date') else rate.date.isoformat(),
            "rate": rate.rate,  # Tasa original (USD→ARS)
            "display_rate": rate.rate,  # Para ARS→USD mostramos el precio del dólar (USD→ARS)
            "source": rate.source,
            "is_manual_override": rate.is_manual_override,
            "confidence_level": rate.confidence_level,
            "notes": rate.notes,
            "created_by": rate.created_by,
            "created_at": rate.created_at.isoformat() if rate.created_at else None,
            "direction": "inverse"
        })
    
    # Ordenar por fecha descendente
    all_rates.sort(key=lambda x: x['date'], reverse=True)
    
    return all_rates

@router.post("/", response_model=ExchangeRateResponse)
def create_exchange_rate(
    rate_data: ExchangeRateCreate,
    db: Session = Depends(get_db)
):
    """Crear una nueva tasa de cambio (manual)"""
    
    print(f"DEBUG: Received rate data: {rate_data.dict()}")
    
    # Extraer solo la fecha sin hora
    if hasattr(rate_data.date, 'date'):
        rate_date = rate_data.date.date()
    else:
        rate_date = rate_data.date
    
    print(f"DEBUG: Extracted date: {rate_date}")
    
    # Crear rango del día completo
    from datetime import datetime, timedelta
    start_of_day = datetime.combine(rate_date, datetime.min.time())
    end_of_day = start_of_day + timedelta(days=1)
    
    print(f"DEBUG: Date range: {start_of_day} to {end_of_day}")
    
    # Buscar tasa existente para ese día
    existing_rate = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.date >= start_of_day,
            ExchangeRate.date < end_of_day,
            ExchangeRate.base_currency == rate_data.base_currency,
            ExchangeRate.target_currency == rate_data.target_currency,
            ExchangeRate.is_active == True
        )
    ).first()
    
    print(f"DEBUG: Found existing rate: {existing_rate}")
    
    if existing_rate:
        print(f"DEBUG: Existing rate details - ID: {existing_rate.id}, Date: {existing_rate.date}, Manual Override: {rate_data.is_manual_override}")
        # Para tasas manuales, siempre permitir sobrescribir
        if rate_data.is_manual_override:
            print("DEBUG: Manual override enabled, deactivating existing rate")
            # Desactivar la tasa existente
            existing_rate.is_active = False
            db.commit()
            print("DEBUG: Existing rate deactivated successfully")
        else:
            # Si no es override manual, informar del conflicto
            raise HTTPException(
                status_code=409,
                detail=f"Ya existe una tasa de cambio para {rate_date.strftime('%d/%m/%Y')}. La tasa existente es {existing_rate.rate} ({existing_rate.source}). Para sobrescribir, use una tasa manual."
            )
    
    print("DEBUG: Creating new rate...")
    # Crear la nueva tasa
    db_rate = ExchangeRate(**rate_data.dict())
    db.add(db_rate)
    db.commit()
    db.refresh(db_rate)
    
    print(f"DEBUG: Successfully created rate with ID: {db_rate.id}")
    return db_rate

@router.put("/{rate_id}", response_model=ExchangeRateResponse)
def update_exchange_rate(
    rate_id: int,
    rate_data: ExchangeRateCreate,
    db: Session = Depends(get_db)
):
    """Actualizar una tasa de cambio existente"""
    
    rate = db.query(ExchangeRate).filter(ExchangeRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Tasa de cambio no encontrada")
    
    for field, value in rate_data.dict().items():
        setattr(rate, field, value)
    
    db.commit()
    db.refresh(rate)
    return rate

@router.delete("/{rate_id}")
def delete_exchange_rate(rate_id: int, db: Session = Depends(get_db)):
    """Eliminar (desactivar) una tasa de cambio"""
    
    rate = db.query(ExchangeRate).filter(ExchangeRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Tasa de cambio no encontrada")
    
    rate.is_active = False
    db.commit()
    
    return {"message": "Tasa de cambio desactivada exitosamente"}

@router.post("/update-from-api")
async def update_rates_from_api(db: Session = Depends(get_db)):
    """Actualizar tasas de cambio desde APIs externos"""
    
    # Obtener fuentes activas ordenadas por prioridad
    sources = db.query(ExchangeRateSource).filter(
        ExchangeRateSource.is_active == True
    ).order_by(ExchangeRateSource.priority).all()
    
    results = []
    
    for source in sources:
        if not source.api_url:
            continue
            
        try:
            # Realizar petición HTTP
            async with aiohttp.ClientSession() as session:
                async with session.get(source.api_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Extraer tasa según el path configurado
                        rate_value = extract_rate_from_response(data, source.response_path)
                        
                        if rate_value:
                            # Crear nueva tasa (siempre crear, no actualizar)
                            new_rate = ExchangeRate(
                                date=datetime.now(),
                                base_currency=source.base_currency,
                                target_currency=source.target_currency,
                                rate=rate_value,
                                source=source.name,
                                source_url=source.api_url,
                                raw_data=json.dumps(data),
                                confidence_level=0.9,  # API tiene menos confianza que manual
                                is_active=True,  # Asegurar que el registro esté activo
                                is_manual_override=False  # Marca como registro automático de API
                            )
                            db.add(new_rate)
                            db.flush()  # Forzar el flush para asegurar que se guarda
                            
                            # Actualizar estadísticas de la fuente
                            source.last_successful_update = datetime.now()
                            source.success_count += 1
                            source.last_error = None
                            
                            results.append({
                                "source": source.name,
                                "status": "success",
                                "rate": rate_value
                            })
                        else:
                            raise ValueError("No se pudo extraer la tasa del response")
                            
        except Exception as e:
            # Actualizar estadísticas de error
            source.error_count += 1
            source.last_error = str(e)
            
            results.append({
                "source": source.name,
                "status": "error",
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "message": "Actualización completada",
        "results": results,
        "updated_at": datetime.now().isoformat()
    }

@router.get("/sources", response_model=List[ExchangeRateSourceResponse])
def list_exchange_rate_sources(db: Session = Depends(get_db)):
    """Listar fuentes de tasas de cambio"""
    return db.query(ExchangeRateSource).all()

@router.get("/export")
def export_exchange_rates(
    base_currency: str = "ARS",
    target_currency: str = "USD",
    days: int = 365,
    format: str = "csv",
    db: Session = Depends(get_db)
):
    """Exportar histórico de tasas de cambio a CSV o JSON"""
    from fastapi.responses import Response
    import csv
    import io
    
    start_date = datetime.now() - timedelta(days=days)
    
    rates = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == base_currency,
            ExchangeRate.target_currency == target_currency,
            ExchangeRate.date >= start_date,
            ExchangeRate.is_active == True
        )
    ).order_by(desc(ExchangeRate.date)).all()
    
    if format.lower() == "csv":
        # Crear CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow([
            "Fecha", "Tasa", "Fuente", "Tipo", "Confianza", 
            "Notas", "Creado Por", "Fecha Creación"
        ])
        
        # Data rows
        for rate in rates:
            writer.writerow([
                rate.date.date().isoformat(),
                rate.rate,
                rate.source,
                "Manual" if rate.is_manual_override else "API",
                f"{rate.confidence_level * 100:.1f}%",
                rate.notes or "",
                rate.created_by or "",
                rate.created_at.isoformat() if rate.created_at else ""
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=tasas_cambio_{base_currency}_{target_currency}.csv"}
        )
    
    else:
        # Formato JSON
        export_data = [
            {
                "fecha": rate.date.date().isoformat(),
                "tasa": rate.rate,
                "fuente": rate.source,
                "tipo": "Manual" if rate.is_manual_override else "API",
                "confianza": rate.confidence_level,
                "notas": rate.notes,
                "creado_por": rate.created_by,
                "fecha_creacion": rate.created_at.isoformat() if rate.created_at else None
            }
            for rate in rates
        ]
        
        return {
            "total_registros": len(export_data),
            "periodo": f"Últimos {days} días",
            "par_monedas": f"{base_currency}/{target_currency}",
            "fecha_exportacion": datetime.now().isoformat(),
            "datos": export_data
        }

@router.get("/statistics")
def get_exchange_rate_statistics(
    base_currency: str = "ARS",
    target_currency: str = "USD",
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Obtener estadísticas avanzadas de tasas de cambio"""
    start_date = datetime.now() - timedelta(days=days)
    
    rates = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == base_currency,
            ExchangeRate.target_currency == target_currency,
            ExchangeRate.date >= start_date,
            ExchangeRate.is_active == True
        )
    ).order_by(ExchangeRate.date).all()
    
    if not rates:
        return {
            "error": "No se encontraron datos para el período solicitado",
            "par_monedas": f"{base_currency}/{target_currency}",
            "periodo": f"Últimos {days} días"
        }
    
    # Calcular estadísticas
    rates_values = [float(rate.rate) for rate in rates]
    
    # Estadísticas básicas
    min_rate = min(rates_values)
    max_rate = max(rates_values)
    avg_rate = sum(rates_values) / len(rates_values)
    
    # Variabilidad
    variance = sum((x - avg_rate) ** 2 for x in rates_values) / len(rates_values)
    volatility = (variance ** 0.5) / avg_rate * 100  # CV como %
    
    # Tendencia (comparación primer vs último)
    trend_change = ((rates_values[-1] - rates_values[0]) / rates_values[0]) * 100
    
    # Por fuente
    source_stats = {}
    for rate in rates:
        source = rate.source
        if source not in source_stats:
            source_stats[source] = {
                "count": 0,
                "manual_overrides": 0,
                "avg_confidence": 0
            }
        source_stats[source]["count"] += 1
        if rate.is_manual_override:
            source_stats[source]["manual_overrides"] += 1
        source_stats[source]["avg_confidence"] += rate.confidence_level
    
    # Promediar confianza
    for source in source_stats:
        if source_stats[source]["count"] > 0:
            source_stats[source]["avg_confidence"] /= source_stats[source]["count"]
            source_stats[source]["avg_confidence"] = round(source_stats[source]["avg_confidence"], 3)
    
    return {
        "par_monedas": f"{base_currency}/{target_currency}",
        "periodo": {
            "dias": days,
            "fecha_inicio": start_date.date().isoformat(),
            "fecha_fin": datetime.now().date().isoformat()
        },
        "resumen": {
            "total_registros": len(rates),
            "tasa_minima": round(min_rate, 4),
            "tasa_maxima": round(max_rate, 4),
            "tasa_promedio": round(avg_rate, 4),
            "volatilidad_pct": round(volatility, 2),
            "tendencia_pct": round(trend_change, 2),
            "rango_variacion": round(max_rate - min_rate, 4)
        },
        "por_fuente": source_stats,
        "datos_recientes": [
            {
                "fecha": rate.date.date().isoformat(),
                "tasa": rate.rate,
                "fuente": rate.source,
                "tipo": "Manual" if rate.is_manual_override else "API"
            }
            for rate in rates[-7:]  # Últimos 7 días
        ]
    }

@router.get("/alerts")
def check_exchange_rate_alerts(
    base_currency: str = "ARS",
    target_currency: str = "USD",
    db: Session = Depends(get_db)
):
    """Verificar alertas para el dashboard"""
    
    # Obtener tasa actual
    current_rate = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == base_currency,
            ExchangeRate.target_currency == target_currency,
            ExchangeRate.is_active == True
        )
    ).order_by(desc(ExchangeRate.date)).first()
    
    if not current_rate:
        return {"alerts": [], "status": "no_data"}
    
    alerts = []
    
    # Alerta 1: Tasa muy antigua (más de 2 días)
    if isinstance(current_rate.date, datetime):
        current_date = current_rate.date.date()
    else:
        current_date = current_rate.date
    days_old = (datetime.now().date() - current_date).days
    if days_old > 2:
        alerts.append({
            "type": "outdated_rate",
            "severity": "warning" if days_old <= 5 else "critical",
            "message": f"La tasa más reciente tiene {days_old} días de antigüedad",
            "detail": f"Última actualización: {current_date.isoformat()}",
            "recommendation": "Ejecutar actualización desde APIs o agregar tasa manual"
        })
    
    # Alerta 2: Baja confianza en API
    if not current_rate.is_manual_override and current_rate.confidence_level < 0.5:
        alerts.append({
            "type": "low_confidence",
            "severity": "warning",
            "message": f"Baja confianza en la fuente: {current_rate.source}",
            "detail": f"Nivel de confianza: {current_rate.confidence_level * 100:.1f}%",
            "recommendation": "Verificar fuente API o agregar tasa manual"
        })
    
    # Alerta 3: Verificar si hay fuentes API desactivadas
    inactive_sources = db.query(ExchangeRateSource).filter(
        ExchangeRateSource.is_active == False
    ).count()
    
    if inactive_sources > 0:
        alerts.append({
            "type": "inactive_sources",
            "severity": "info",
            "message": f"{inactive_sources} fuente(s) de API desactivada(s)",
            "detail": "Algunas fuentes automáticas están deshabilitadas",
            "recommendation": "Revisar configuración de fuentes en panel de administración"
        })
    
    # Alerta 4: Verificar errores recientes en APIs
    failed_sources = db.query(ExchangeRateSource).filter(
        and_(
            ExchangeRateSource.is_active == True,
            ExchangeRateSource.error_count > 5,
            ExchangeRateSource.success_count == 0
        )
    ).count()
    
    if failed_sources > 0:
        alerts.append({
            "type": "api_failures",
            "severity": "critical",
            "message": f"{failed_sources} fuente(s) con errores consecutivos",
            "detail": "APIs no responden o devuelven errores",
            "recommendation": "Verificar conectividad y configuración de APIs"
        })
    
    # Determinar status general
    severities = [alert["severity"] for alert in alerts]
    if "critical" in severities:
        status = "critical"
    elif "warning" in severities:
        status = "warning"
    elif "info" in severities:
        status = "info"
    else:
        status = "ok"
    
    return {
        "status": status,
        "total_alerts": len(alerts),
        "alerts": alerts,
        "current_rate": {
            "date": current_date.isoformat(),
            "rate": current_rate.rate,
            "source": current_rate.source,
            "confidence": current_rate.confidence_level,
            "is_manual": current_rate.is_manual_override
        },
        "last_check": datetime.now().isoformat()
    }

@router.get("/validate")
def validate_exchange_rates(
    base_currency: str = "ARS",
    target_currency: str = "USD",
    days: int = 7,
    threshold_pct: float = 15.0,
    db: Session = Depends(get_db)
):
    """Validar tasas de cambio para detectar anomalías"""
    
    # Obtener tasas recientes
    start_date = datetime.now() - timedelta(days=days)
    
    rates = db.query(ExchangeRate).filter(
        and_(
            ExchangeRate.base_currency == base_currency,
            ExchangeRate.target_currency == target_currency,
            ExchangeRate.date >= start_date,
            ExchangeRate.is_active == True
        )
    ).order_by(ExchangeRate.date).all()
    
    if len(rates) < 2:
        return {
            "status": "insufficient_data",
            "message": "Necesita al menos 2 registros para validar",
            "total_rates": len(rates)
        }
    
    # Calcular promedio de referencia (excluyendo outliers)
    rates_values = [float(rate.rate) for rate in rates]
    avg_rate = sum(rates_values) / len(rates_values)
    
    # Detectar anomalías
    anomalies = []
    warnings = []
    
    for i, rate in enumerate(rates):
        rate_value = float(rate.rate)
        
        # Validación 1: Desviación del promedio
        deviation_pct = abs((rate_value - avg_rate) / avg_rate) * 100
        
        if deviation_pct > threshold_pct:
            anomalies.append({
                "fecha": rate.date.date().isoformat(),
                "tasa": rate_value,
                "problema": "Desviación excesiva del promedio",
                "desviacion_pct": round(deviation_pct, 2),
                "fuente": rate.source,
                "tipo": "Manual" if rate.is_manual_override else "API"
            })
        
        # Validación 2: Cambio brusco día a día
        if i > 0:
            prev_rate = float(rates[i-1].rate)
            daily_change_pct = abs((rate_value - prev_rate) / prev_rate) * 100
            
            if daily_change_pct > (threshold_pct / 2):  # 50% del threshold para cambios diarios
                warnings.append({
                    "fecha": rate.date.date().isoformat(),
                    "tasa_actual": rate_value,
                    "tasa_anterior": prev_rate,
                    "cambio_pct": round(daily_change_pct, 2),
                    "problema": "Cambio diario brusco",
                    "fuente": rate.source
                })
        
        # Validación 3: Confianza baja en APIs
        if not rate.is_manual_override and rate.confidence_level < 0.7:
            warnings.append({
                "fecha": rate.date.date().isoformat(),
                "tasa": rate_value,
                "problema": "Baja confianza de la fuente API",
                "confianza": round(rate.confidence_level, 3),
                "fuente": rate.source
            })
    
    # Status general
    status = "clean"
    if anomalies:
        status = "anomalies_detected"
    elif warnings:
        status = "warnings_found"
    
    return {
        "status": status,
        "par_monedas": f"{base_currency}/{target_currency}",
        "periodo_validado": f"Últimos {days} días",
        "threshold_usado": f"{threshold_pct}%",
        "resumen": {
            "total_rates": len(rates),
            "anomalias": len(anomalies),
            "advertencias": len(warnings),
            "tasa_promedio": round(avg_rate, 4)
        },
        "anomalias": anomalies,
        "advertencias": warnings,
        "recomendaciones": [
            "Revisar tasas con desviación > 15%" if anomalies else None,
            "Verificar fuentes con baja confianza" if any(w.get("confianza", 1) < 0.7 for w in warnings) else None,
            "Considerar override manual para fechas anómalas" if anomalies else None
        ]
    }

def extract_rate_from_response(data: Dict[Any, Any], path: str) -> Optional[float]:
    """Extraer tasa de cambio del response JSON usando el path configurado"""
    
    if not path:
        return None
    
    try:
        # Manejar paths simples como "venta" o "compra"
        if path in data:
            value = data[path]
            # Limpiar el valor si es string
            if isinstance(value, str):
                # Remover símbolos de moneda y comas
                value = value.replace('$', '').replace(',', '').strip()
            return float(value)
        
        # Manejar paths de array como "[0].casa.venta"
        if path.startswith('[') and ']' in path:
            # Extraer índice del array
            end_bracket = path.index(']')
            index = int(path[1:end_bracket])
            remaining_path = path[end_bracket + 2:]  # +2 para saltar ].
            
            if isinstance(data, list) and len(data) > index:
                return extract_rate_from_path(data[index], remaining_path)
        
        # Manejar paths con punto como "casa.venta"
        if '.' in path:
            return extract_rate_from_path(data, path)
            
    except (ValueError, KeyError, IndexError, TypeError):
        return None
    
    return None

def extract_rate_from_path(data: Dict[Any, Any], path: str) -> Optional[float]:
    """Extraer valor usando notación de punto"""
    parts = path.split('.')
    current = data
    
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    
    # Convertir a float
    if isinstance(current, str):
        current = current.replace('$', '').replace(',', '').strip()
    
    return float(current)