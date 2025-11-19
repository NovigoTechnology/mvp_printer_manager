from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.db import get_db
from app.models import DiscoveryConfig

router = APIRouter()

# Pydantic models
class DiscoveryConfigCreate(BaseModel):
    name: str
    ip_ranges: str
    description: str = None

class DiscoveryConfigUpdate(BaseModel):
    name: str = None
    ip_ranges: str = None
    description: str = None
    is_active: bool = None

class DiscoveryConfigResponse(BaseModel):
    id: int
    name: str
    ip_ranges: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/configs", response_model=List[DiscoveryConfigResponse])
def get_discovery_configs(db: Session = Depends(get_db)):
    """Obtener todas las configuraciones de descubrimiento"""
    configs = db.query(DiscoveryConfig).filter(DiscoveryConfig.is_active == True).all()
    return configs

@router.post("/configs", response_model=DiscoveryConfigResponse)
def create_discovery_config(config: DiscoveryConfigCreate, db: Session = Depends(get_db)):
    """Crear una nueva configuración de descubrimiento"""
    # Verificar que el nombre no esté duplicado
    existing = db.query(DiscoveryConfig).filter(
        DiscoveryConfig.name == config.name,
        DiscoveryConfig.is_active == True
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una configuración con el nombre '{config.name}'"
        )
    
    # Validar formato de rangos IP básico
    if not config.ip_ranges.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los rangos IP no pueden estar vacíos"
        )
    
    db_config = DiscoveryConfig(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return db_config

@router.put("/configs/{config_id}", response_model=DiscoveryConfigResponse)
def update_discovery_config(
    config_id: int, 
    config: DiscoveryConfigUpdate, 
    db: Session = Depends(get_db)
):
    """Actualizar una configuración de descubrimiento"""
    db_config = db.query(DiscoveryConfig).filter(DiscoveryConfig.id == config_id).first()
    
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )
    
    # Verificar nombre duplicado si se está cambiando
    if config.name and config.name != db_config.name:
        existing = db.query(DiscoveryConfig).filter(
            DiscoveryConfig.name == config.name,
            DiscoveryConfig.is_active == True,
            DiscoveryConfig.id != config_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una configuración con el nombre '{config.name}'"
            )
    
    # Actualizar campos proporcionados
    update_data = config.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db.commit()
    db.refresh(db_config)
    
    return db_config

@router.delete("/configs/{config_id}")
def delete_discovery_config(config_id: int, db: Session = Depends(get_db)):
    """Eliminar (marcar como inactiva) una configuración de descubrimiento"""
    db_config = db.query(DiscoveryConfig).filter(DiscoveryConfig.id == config_id).first()
    
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )
    
    db_config.is_active = False
    db.commit()
    
    return {"message": "Configuración eliminada exitosamente"}

@router.get("/configs/{config_id}", response_model=DiscoveryConfigResponse)
def get_discovery_config(config_id: int, db: Session = Depends(get_db)):
    """Obtener una configuración específica"""
    config = db.query(DiscoveryConfig).filter(
        DiscoveryConfig.id == config_id,
        DiscoveryConfig.is_active == True
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )
    
    return config