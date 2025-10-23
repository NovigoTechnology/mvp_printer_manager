from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import Incident, Printer

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
    
    # Add printer info to each incident
    for incident in incidents:
        printer = db.query(Printer).filter(Printer.id == incident.printer_id).first()
        if printer:
            incident.printer = {
                "id": printer.id,
                "brand": printer.brand,
                "model": printer.model,
                "location": printer.location
            }
    
    return incidents

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
    
    # If status is being changed to resolved, set resolved_at
    if "status" in update_data and update_data["status"] == "resolved":
        update_data["resolved_at"] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(incident, field, value)
    
    db.commit()
    db.refresh(incident)
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