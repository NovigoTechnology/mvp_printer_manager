from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from ..db import get_db
from ..models import Printer, MedicalPrinterRefill, Incident, TonerRequest

router = APIRouter()
logger = logging.getLogger(__name__)

class RefillCreate(BaseModel):
    printer_id: int
    tray_name: str
    cartridge_quantity: int = 1
    plates_per_cartridge: int = 100
    counter_before_refill: Optional[int] = 0
    available_before_refill: Optional[int] = 0
    incident_id: Optional[int] = None
    toner_request_id: Optional[int] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    supplier: Optional[str] = None
    cost: Optional[float] = 0.0
    loaded_by: Optional[str] = None
    notes: Optional[str] = None

class RefillResponse(BaseModel):
    id: int
    printer_id: int
    refill_date: datetime
    tray_name: str
    cartridge_quantity: int
    plates_per_cartridge: int
    total_plates_added: int
    counter_before_refill: int
    available_before_refill: int
    counter_after_refill: Optional[int]
    available_after_refill: Optional[int]
    incident_id: Optional[int]
    toner_request_id: Optional[int]
    batch_number: Optional[str]
    expiry_date: Optional[datetime]
    supplier: Optional[str]
    cost: float
    loaded_by: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True

@router.post("/refills", response_model=RefillResponse)
async def create_refill(refill: RefillCreate, db: Session = Depends(get_db)):
    """
    Registrar una recarga de cartucho en una impresora médica
    """
    try:
        # Verificar que la impresora existe
        printer = db.query(Printer).filter(Printer.id == refill.printer_id).first()
        if not printer:
            raise HTTPException(status_code=404, detail="Impresora no encontrada")
        
        # Calcular total de placas agregadas
        total_plates = refill.cartridge_quantity * refill.plates_per_cartridge
        
        # Crear el registro de recarga
        new_refill = MedicalPrinterRefill(
            printer_id=refill.printer_id,
            tray_name=refill.tray_name,
            cartridge_quantity=refill.cartridge_quantity,
            plates_per_cartridge=refill.plates_per_cartridge,
            total_plates_added=total_plates,
            counter_before_refill=refill.counter_before_refill or 0,
            available_before_refill=refill.available_before_refill or 0,
            incident_id=refill.incident_id,
            toner_request_id=refill.toner_request_id,
            batch_number=refill.batch_number,
            expiry_date=refill.expiry_date,
            supplier=refill.supplier,
            cost=refill.cost or 0.0,
            loaded_by=refill.loaded_by,
            notes=refill.notes
        )
        
        db.add(new_refill)
        db.commit()
        db.refresh(new_refill)
        
        logger.info(f"Recarga registrada: {total_plates} placas en {refill.tray_name} de impresora {refill.printer_id}")
        
        return new_refill
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creando registro de recarga: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al registrar recarga: {str(e)}")

@router.get("/refills", response_model=List[RefillResponse])
async def list_refills(
    printer_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Listar recargas de cartuchos
    """
    try:
        query = db.query(MedicalPrinterRefill).order_by(desc(MedicalPrinterRefill.refill_date))
        
        if printer_id:
            query = query.filter(MedicalPrinterRefill.printer_id == printer_id)
        
        refills = query.limit(limit).all()
        return refills
        
    except Exception as e:
        logger.error(f"Error listando recargas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al listar recargas: {str(e)}")

@router.get("/refills/{refill_id}", response_model=RefillResponse)
async def get_refill(refill_id: int, db: Session = Depends(get_db)):
    """
    Obtener detalles de una recarga específica
    """
    refill = db.query(MedicalPrinterRefill).filter(MedicalPrinterRefill.id == refill_id).first()
    
    if not refill:
        raise HTTPException(status_code=404, detail="Recarga no encontrada")
    
    return refill

@router.get("/{printer_id}/refills", response_model=List[RefillResponse])
async def get_printer_refills(
    printer_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Obtener historial de recargas de una impresora específica
    """
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    refills = db.query(MedicalPrinterRefill).filter(
        MedicalPrinterRefill.printer_id == printer_id
    ).order_by(desc(MedicalPrinterRefill.refill_date)).limit(limit).all()
    
    return refills

@router.put("/refills/{refill_id}", response_model=RefillResponse)
async def update_refill(
    refill_id: int,
    counter_after: Optional[int] = None,
    available_after: Optional[int] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Actualizar información de una recarga (especialmente contadores después de la recarga)
    """
    refill = db.query(MedicalPrinterRefill).filter(MedicalPrinterRefill.id == refill_id).first()
    
    if not refill:
        raise HTTPException(status_code=404, detail="Recarga no encontrada")
    
    try:
        if counter_after is not None:
            refill.counter_after_refill = counter_after
        if available_after is not None:
            refill.available_after_refill = available_after
        if notes is not None:
            refill.notes = notes
        
        db.commit()
        db.refresh(refill)
        
        return refill
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error actualizando recarga: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar recarga: {str(e)}")

@router.delete("/refills/{refill_id}")
async def delete_refill(refill_id: int, db: Session = Depends(get_db)):
    """
    Eliminar un registro de recarga
    """
    refill = db.query(MedicalPrinterRefill).filter(MedicalPrinterRefill.id == refill_id).first()
    
    if not refill:
        raise HTTPException(status_code=404, detail="Recarga no encontrada")
    
    try:
        db.delete(refill)
        db.commit()
        
        return {"success": True, "message": "Recarga eliminada correctamente"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error eliminando recarga: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar recarga: {str(e)}")
