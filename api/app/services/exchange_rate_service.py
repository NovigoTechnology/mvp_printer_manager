import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..db import get_db_session
from ..models import ExchangeRate, ExchangeRateSource

class ExchangeRateService:
    """Servicio para manejar tasas de cambio automáticas"""
    
    def __init__(self):
        self.session = None
        
    async def update_all_rates(self) -> Dict[str, Any]:
        """Actualizar todas las tasas de cambio desde APIs externos"""
        
        try:
            # Obtener sesión de base de datos
            self.session = get_db_session()
            
            # Obtener fuentes activas ordenadas por prioridad
            sources = self.session.query(ExchangeRateSource).filter(
                ExchangeRateSource.is_active == True
            ).order_by(ExchangeRateSource.priority).all()
            
            results = []
            
            # Procesar cada fuente
            for source in sources:
                if not source.api_url:
                    continue
                    
                try:
                    result = await self._update_from_source(source)
                    results.append(result)
                    
                except Exception as e:
                    # Actualizar estadísticas de error
                    source.error_count = (source.error_count or 0) + 1
                    source.last_error = str(e)
                    
                    results.append({
                        "source": source.name,
                        "status": "error",
                        "error": str(e),
                        "timestamp": datetime.now().isoformat()
                    })
            
            # Confirmar cambios
            self.session.commit()
            
            return {
                "status": "completed",
                "total_sources": len(sources),
                "results": results,
                "updated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            if self.session:
                self.session.rollback()
            return {
                "status": "error",
                "error": str(e),
                "updated_at": datetime.now().isoformat()
            }
        finally:
            if self.session:
                self.session.close()
    
    async def _update_from_source(self, source: ExchangeRateSource) -> Dict[str, Any]:
        """Actualizar tasa desde una fuente específica"""
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
            async with session.get(source.api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Extraer tasa según el path configurado
                    rate_value = self._extract_rate_from_response(data, source.response_path)
                    
                    if rate_value and rate_value > 0:
                        # Crear o actualizar tasa
                        success = await self._save_exchange_rate(
                            source=source,
                            rate_value=rate_value,
                            raw_data=data
                        )
                        
                        if success:
                            # Actualizar estadísticas de la fuente
                            source.last_successful_update = datetime.now()
                            source.success_count = (source.success_count or 0) + 1
                            source.last_error = None
                            
                            return {
                                "source": source.name,
                                "status": "success",
                                "rate": rate_value,
                                "currency_pair": f"{source.base_currency}/{source.target_currency}",
                                "timestamp": datetime.now().isoformat()
                            }
                        else:
                            raise Exception("Error al guardar la tasa en base de datos")
                    else:
                        raise ValueError("No se pudo extraer una tasa válida del response")
                else:
                    raise Exception(f"HTTP {response.status}: {await response.text()}")
    
    async def _save_exchange_rate(self, source: ExchangeRateSource, rate_value: float, raw_data: Dict) -> bool:
        """Guardar tasa de cambio en base de datos"""
        
        try:
            today = datetime.now().date()
            
            # Buscar tasa existente para hoy (no manual)
            existing_rate = self.session.query(ExchangeRate).filter(
                and_(
                    ExchangeRate.date >= today,
                    ExchangeRate.date < today + timedelta(days=1),
                    ExchangeRate.base_currency == source.base_currency,
                    ExchangeRate.target_currency == source.target_currency,
                    ExchangeRate.source == source.name,
                    ExchangeRate.is_manual_override == False
                )
            ).first()
            
            if existing_rate:
                # Actualizar tasa existente
                existing_rate.rate = rate_value
                existing_rate.raw_data = json.dumps(raw_data)
                existing_rate.updated_at = datetime.now()
                existing_rate.source_url = source.api_url
            else:
                # Crear nueva tasa
                new_rate = ExchangeRate(
                    date=datetime.now(),
                    base_currency=source.base_currency,
                    target_currency=source.target_currency,
                    rate=rate_value,
                    source=source.name,
                    source_url=source.api_url,
                    raw_data=json.dumps(raw_data),
                    confidence_level=0.85,  # API tiene buena confianza pero menos que manual
                    is_manual_override=False,
                    is_active=True
                )
                self.session.add(new_rate)
            
            return True
            
        except Exception as e:
            print(f"Error guardando tasa de cambio: {e}")
            return False
    
    def _extract_rate_from_response(self, data: Dict[Any, Any], path: str) -> Optional[float]:
        """Extraer tasa de cambio del response JSON usando el path configurado"""
        
        if not path or not data:
            return None
        
        try:
            # Manejar paths simples como "venta" o "compra"
            if path in data:
                value = data[path]
                return self._clean_and_convert_to_float(value)
            
            # Manejar paths de array como "[0].casa.venta"
            if path.startswith('[') and ']' in path:
                end_bracket = path.index(']')
                index = int(path[1:end_bracket])
                remaining_path = path[end_bracket + 2:] if len(path) > end_bracket + 1 else ""
                
                if isinstance(data, list) and len(data) > index:
                    if remaining_path:
                        return self._extract_from_path(data[index], remaining_path)
                    else:
                        return self._clean_and_convert_to_float(data[index])
            
            # Manejar paths con punto como "casa.venta"
            if '.' in path:
                return self._extract_from_path(data, path)
                
        except (ValueError, KeyError, IndexError, TypeError) as e:
            print(f"Error extrayendo tasa con path '{path}': {e}")
            return None
        
        return None
    
    def _extract_from_path(self, data: Dict[Any, Any], path: str) -> Optional[float]:
        """Extraer valor usando notación de punto"""
        parts = path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        
        return self._clean_and_convert_to_float(current)
    
    def _clean_and_convert_to_float(self, value: Any) -> Optional[float]:
        """Limpiar y convertir valor a float"""
        try:
            if isinstance(value, (int, float)):
                return float(value)
            
            if isinstance(value, str):
                # Limpiar string: remover símbolos de moneda, comas, espacios
                cleaned = value.replace('$', '').replace('€', '').replace(',', '').replace(' ', '').strip()
                return float(cleaned)
            
            return float(value)
            
        except (ValueError, TypeError):
            return None

# Función para usar en el scheduler
async def update_exchange_rates_task():
    """Tarea para actualizar tasas de cambio (para usar en scheduler)"""
    service = ExchangeRateService()
    result = await service.update_all_rates()
    print(f"Actualización de tasas de cambio: {result['status']}")
    return result

# Función de conveniencia para obtener tasa actual
def get_current_exchange_rate(
    base_currency: str = "ARS", 
    target_currency: str = "USD",
    date_for_rate: Optional[datetime] = None
) -> Optional[float]:
    """
    Obtener tasa de cambio actual o para una fecha específica
    Prioriza tasas manuales sobre automáticas
    """
    
    session = get_db_session()
    try:
        # Si no se especifica fecha, usar hoy
        if not date_for_rate:
            date_for_rate = datetime.now()
        
        # Buscar tasa exacta para la fecha (priorizando manuales)
        from sqlalchemy import func, Date
        rate = session.query(ExchangeRate).filter(
            and_(
                func.date(ExchangeRate.date) == date_for_rate.date(),
                ExchangeRate.base_currency == base_currency,
                ExchangeRate.target_currency == target_currency,
                ExchangeRate.is_active == True
            )
        ).order_by(
            ExchangeRate.is_manual_override.desc(),  # Manuales primero
            ExchangeRate.confidence_level.desc(),    # Luego por confianza
            ExchangeRate.created_at.desc()           # Finalmente por fecha de creación
        ).first()
        
        if rate:
            return rate.rate
        
        # Si no hay tasa exacta, buscar la más reciente anterior
        rate = session.query(ExchangeRate).filter(
            and_(
                ExchangeRate.date <= date_for_rate,
                ExchangeRate.base_currency == base_currency,
                ExchangeRate.target_currency == target_currency,
                ExchangeRate.is_active == True
            )
        ).order_by(
            ExchangeRate.date.desc(),
            ExchangeRate.is_manual_override.desc(),
            ExchangeRate.confidence_level.desc()
        ).first()
        
        return rate.rate if rate else None
        
    finally:
        session.close()


def get_current_exchange_rate_with_info(
    base_currency: str = "ARS", 
    target_currency: str = "USD",
    date_for_rate: Optional[datetime] = None
) -> Optional[Dict[str, Any]]:
    """
    Obtener tasa de cambio actual con información completa (fecha, hora, fuente)
    """
    
    session = get_db_session()
    try:
        # Si no se especifica fecha, usar hoy
        if not date_for_rate:
            date_for_rate = datetime.now()
        
        # Buscar tasa exacta para la fecha (priorizando manuales)
        from sqlalchemy import func, Date
        rate = session.query(ExchangeRate).filter(
            and_(
                func.date(ExchangeRate.date) == date_for_rate.date(),
                ExchangeRate.base_currency == base_currency,
                ExchangeRate.target_currency == target_currency,
                ExchangeRate.is_active == True
            )
        ).order_by(
            ExchangeRate.is_manual_override.desc(),  # Manuales primero
            ExchangeRate.confidence_level.desc(),    # Luego por confianza
            ExchangeRate.created_at.desc()           # Finalmente por fecha de creación
        ).first()
        
        if rate:
            return {
                "rate": rate.rate,
                "date": rate.date,
                "created_at": rate.created_at,
                "updated_at": rate.updated_at,
                "source": rate.source,
                "is_manual_override": rate.is_manual_override,
                "confidence_level": rate.confidence_level
            }
        
        # Si no hay tasa exacta, buscar la más reciente anterior
        rate = session.query(ExchangeRate).filter(
            and_(
                ExchangeRate.date <= date_for_rate,
                ExchangeRate.base_currency == base_currency,
                ExchangeRate.target_currency == target_currency,
                ExchangeRate.is_active == True
            )
        ).order_by(
            ExchangeRate.date.desc(),
            ExchangeRate.is_manual_override.desc(),
            ExchangeRate.confidence_level.desc()
        ).first()
        
        if rate:
            return {
                "rate": rate.rate,
                "date": rate.date,
                "created_at": rate.created_at,
                "updated_at": rate.updated_at,
                "source": rate.source,
                "is_manual_override": rate.is_manual_override,
                "confidence_level": rate.confidence_level
            }
        
        return None
        
    finally:
        session.close()