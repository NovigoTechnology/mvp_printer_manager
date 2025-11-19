from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import Incident, Printer, TonerRequest

router = APIRouter()

class IncidentCreate(BaseModel):
    printer_id: int
    title: str
    description: Optional[str] = None
    priority: str = "medium"

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

class IncidentResponse(BaseModel):
    id: int
    printer_id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    created_at: datetime
    updated_at: Optional[datetime]
    resolved_at: Optional[datetime]
    printer: Optional[dict] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = None,
    printer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List incidents with optional filtering"""
    query = db.query(Incident)
    
    if status:
        query = query.filter(Incident.status == status)
    if printer_id:
        query = query.filter(Incident.printer_id == printer_id)
    
    incidents = query.order_by(Incident.created_at.desc()).all()
    
    # Join with printer data using proper SQLAlchemy relationships
    result = []
    for incident in incidents:
        incident_dict = {
            "id": incident.id,
            "printer_id": incident.printer_id,
            "title": incident.title,
            "description": incident.description,
            "status": incident.status,
            "priority": incident.priority,
            "created_at": incident.created_at,
            "updated_at": incident.updated_at,
            "resolved_at": incident.resolved_at,
            "printer": None,
            "toner_requests": []
        }
        
        # Get printer info
        printer = db.query(Printer).filter(Printer.id == incident.printer_id).first()
        if printer:
            incident_dict["printer"] = {
                "id": printer.id,
                "brand": printer.brand,
                "model": printer.model,
                "location": printer.location
            }
        
        # Get related toner requests
        toner_requests = db.query(TonerRequest).filter(TonerRequest.incident_id == incident.id).all()
        incident_dict["toner_requests"] = [
            {
                "id": req.id,
                "requested_by": req.requested_by,
                "justification": req.justification,
                "status": req.status,
                "created_at": req.created_at
            }
            for req in toner_requests
        ]
        
        result.append(incident_dict)
    
    return result

@router.post("/", response_model=IncidentResponse)
def create_incident(incident: IncidentCreate, db: Session = Depends(get_db)):
    """Create a new incident"""
    # Check if printer exists
    printer = db.query(Printer).filter(Printer.id == incident.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    db_incident = Incident(**incident.dict())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Get a specific incident"""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Add printer info
    printer = db.query(Printer).filter(Printer.id == incident.printer_id).first()
    if printer:
        incident.printer = {
            "id": printer.id,
            "brand": printer.brand,
            "model": printer.model,
            "location": printer.location
        }
    
    return incident

@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: int, incident_update: IncidentUpdate, db: Session = Depends(get_db)):
    """Update an incident"""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    update_data = incident_update.dict(exclude_unset=True)
    old_status = incident.status
    
    # If status is being changed to resolved, set resolved_at
    if "status" in update_data and update_data["status"] == "resolved":
        update_data["resolved_at"] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(incident, field, value)
    
    db.commit()
    db.refresh(incident)
    
    # Actualizar estado de solicitudes de tóner relacionadas si el estado del incidente cambió
    if "status" in update_data and update_data["status"] != old_status:
        new_status = update_data["status"]
        
        # Buscar solicitudes de tóner relacionadas con este incidente
        related_requests = db.query(TonerRequest).filter(TonerRequest.incident_id == incident_id).all()
        
        for request in related_requests:
            if new_status == "in_progress":
                request.status = "approved"
                request.approved_date = datetime.utcnow()
                request.approved_by = "Sistema (por actualización de incidente)"
            elif new_status == "resolved":
                request.status = "delivered"
                request.delivered_date = datetime.utcnow()
        
        db.commit()
    
    return incident

@router.delete("/{incident_id}")
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    """Delete an incident"""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    db.delete(incident)
    db.commit()
    return {"message": "Incident deleted successfully"}

@router.get("/stats/summary")
def get_incident_stats(db: Session = Depends(get_db)):
    """Get incident statistics summary"""
    total = db.query(Incident).count()
    open_incidents = db.query(Incident).filter(Incident.status == "open").count()
    in_progress = db.query(Incident).filter(Incident.status == "in_progress").count()
    resolved = db.query(Incident).filter(Incident.status == "resolved").count()
    
    critical = db.query(Incident).filter(
        Incident.priority == "critical",
        Incident.status != "resolved"
    ).count()
    
    return {
        "total": total,
        "open": open_incidents,
        "in_progress": in_progress,
        "resolved": resolved,
        "critical_active": critical
    }