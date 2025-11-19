from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import Company

router = APIRouter()

# Los schemas están definidos en contracts.py para evitar dependencias circulares
from .contracts import CompanyCreate, CompanyResponse

@router.post("/", response_model=CompanyResponse)
def create_company(company: CompanyCreate, db: Session = Depends(get_db)):
    """Crear nueva empresa"""
    
    # Verificar si ya existe una empresa con el mismo tax_id
    existing_company = db.query(Company).filter(Company.tax_id == company.tax_id).first()
    if existing_company:
        raise HTTPException(status_code=400, detail=f"Ya existe una empresa con el tax_id: {company.tax_id}")
    
    # Crear nueva empresa
    db_company = Company(**company.dict())
    
    try:
        db.add(db_company)
        db.commit()
        db.refresh(db_company)
        return db_company
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando empresa: {str(e)}")

@router.get("/", response_model=List[CompanyResponse])
def list_companies(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar todas las empresas con filtros opcionales"""
    
    query = db.query(Company)
    
    # Filtro por estado
    if status:
        query = query.filter(Company.status == status)
    
    # Búsqueda por nombre o tax_id
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            Company.name.ilike(search_term) | 
            Company.tax_id.ilike(search_term) |
            Company.legal_name.ilike(search_term)
        )
    
    # Ordenar por nombre
    query = query.order_by(Company.name)
    
    companies = query.offset(skip).limit(limit).all()
    return companies

@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db)):
    """Obtener empresa por ID"""
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    return company

@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(company_id: int, company_update: CompanyCreate, db: Session = Depends(get_db)):
    """Actualizar empresa"""
    
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Verificar si el nuevo tax_id no está siendo usado por otra empresa
    if company_update.tax_id != db_company.tax_id:
        existing_company = db.query(Company).filter(
            Company.tax_id == company_update.tax_id,
            Company.id != company_id
        ).first()
        if existing_company:
            raise HTTPException(status_code=400, detail=f"Ya existe otra empresa con el tax_id: {company_update.tax_id}")
    
    # Actualizar campos
    update_data = company_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_company, field, value)
    
    try:
        db.commit()
        db.refresh(db_company)
        return db_company
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error actualizando empresa: {str(e)}")

@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    """Eliminar empresa (soft delete cambiando estado a inactive)"""
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Verificar si la empresa está siendo usada en contratos activos
    from ..models import ContractCompany, LeaseContract
    active_contracts = db.query(ContractCompany).join(LeaseContract).filter(
        ContractCompany.company_id == company_id,
        ContractCompany.is_active == True,
        LeaseContract.status == "active"
    ).count()
    
    if active_contracts > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar la empresa. Está asociada a {active_contracts} contrato(s) activo(s)"
        )
    
    # Soft delete
    company.status = "inactive"
    
    try:
        db.commit()
        return {"message": "Empresa eliminada correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error eliminando empresa: {str(e)}")

@router.get("/{company_id}/contracts")
def get_company_contracts(company_id: int, db: Session = Depends(get_db)):
    """Obtener todos los contratos asociados a una empresa"""
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    from ..models import ContractCompany, LeaseContract
    
    # Obtener contratos con información de la relación
    contracts_info = db.query(
        LeaseContract, ContractCompany
    ).join(
        ContractCompany, LeaseContract.id == ContractCompany.contract_id
    ).filter(
        ContractCompany.company_id == company_id,
        ContractCompany.is_active == True
    ).all()
    
    result = []
    for contract, contract_company in contracts_info:
        result.append({
            "contract": {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "contract_name": contract.contract_name,
                "supplier": contract.supplier,
                "status": contract.status,
                "start_date": contract.start_date,
                "end_date": contract.end_date
            },
            "relationship": {
                "role": contract_company.role,
                "participation_percentage": contract_company.participation_percentage,
                "is_primary": contract_company.is_primary,
                "start_date": contract_company.start_date,
                "end_date": contract_company.end_date
            }
        })
    
    return result