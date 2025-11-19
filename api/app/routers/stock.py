from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import json

from ..db import get_db
from ..models import StockLocation, StockItem, StockMovement, StockCurrent, Printer

router = APIRouter()

# Pydantic models
class StockLocationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location_type: str = "warehouse"
    address: Optional[str] = None
    responsible_person: Optional[str] = None

class StockLocationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    location_type: str
    address: Optional[str]
    responsible_person: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class StockItemCreate(BaseModel):
    item_code: str
    item_name: str
    item_type: str
    brand: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    compatible_printers: Optional[str] = None
    unit_of_measure: str = "unidad"
    minimum_stock: int = 0
    maximum_stock: int = 100
    cost_per_unit: float = 0.00
    supplier: Optional[str] = None
    supplier_code: Optional[str] = None
    storage_location_id: Optional[int] = None

class StockItemResponse(BaseModel):
    id: int
    item_code: str
    item_name: str
    item_type: str
    brand: Optional[str]
    model: Optional[str]
    description: Optional[str]
    compatible_printers: Optional[str]
    unit_of_measure: str
    minimum_stock: int
    maximum_stock: int
    cost_per_unit: float
    supplier: Optional[str]
    supplier_code: Optional[str]
    storage_location_id: Optional[int]
    is_active: bool
    created_at: datetime
    current_stock: Optional[int] = 0
    reserved_stock: Optional[int] = 0
    available_stock: Optional[int] = 0

    class Config:
        from_attributes = True

class StockMovementCreate(BaseModel):
    stock_item_id: int
    movement_type: str  # in, out, transfer, adjustment
    quantity: int
    unit_cost: float = 0.00
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    source_location_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    printer_id: Optional[int] = None
    notes: Optional[str] = None
    moved_by: str

class StockMovementResponse(BaseModel):
    id: int
    stock_item_id: int
    movement_type: str
    quantity: int
    unit_cost: float
    total_cost: float
    reference_type: Optional[str]
    reference_id: Optional[int]
    source_location_id: Optional[int]
    destination_location_id: Optional[int]
    printer_id: Optional[int]
    notes: Optional[str]
    moved_by: str
    movement_date: datetime
    # Related objects
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    source_location_name: Optional[str] = None
    destination_location_name: Optional[str] = None
    printer_info: Optional[str] = None

    class Config:
        from_attributes = True

# Stock Locations endpoints
@router.get("/locations/", response_model=List[StockLocationResponse])
def list_stock_locations(db: Session = Depends(get_db)):
    """List all stock locations"""
    locations = db.query(StockLocation).filter(StockLocation.is_active == True).all()
    return locations

@router.post("/locations/", response_model=StockLocationResponse)
def create_stock_location(location: StockLocationCreate, db: Session = Depends(get_db)):
    """Create a new stock location"""
    db_location = StockLocation(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

@router.get("/locations/{location_id}", response_model=StockLocationResponse)
def get_stock_location(location_id: int, db: Session = Depends(get_db)):
    """Get a specific stock location"""
    location = db.query(StockLocation).filter(StockLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

# Stock Items endpoints
@router.get("/items/", response_model=List[StockItemResponse])
def list_stock_items(
    item_type: Optional[str] = None,
    low_stock: bool = False,
    db: Session = Depends(get_db)
):
    """List all stock items with current stock levels"""
    query = db.query(
        StockItem,
        func.coalesce(func.sum(StockCurrent.current_quantity), 0).label('current_stock'),
        func.coalesce(func.sum(StockCurrent.reserved_quantity), 0).label('reserved_stock'),
        func.coalesce(func.sum(StockCurrent.current_quantity - StockCurrent.reserved_quantity), 0).label('available_stock')
    ).outerjoin(StockCurrent).group_by(StockItem.id)
    
    if item_type:
        query = query.filter(StockItem.item_type == item_type)
    
    query = query.filter(StockItem.is_active == True)
    
    results = query.all()
    
    items = []
    for item, current_stock, reserved_stock, available_stock in results:
        item_dict = item.__dict__.copy()
        item_dict['current_stock'] = current_stock
        item_dict['reserved_stock'] = reserved_stock
        item_dict['available_stock'] = available_stock
        
        # Filter low stock items if requested
        if low_stock and current_stock >= item.minimum_stock:
            continue
            
        items.append(StockItemResponse(**item_dict))
    
    return items

@router.post("/items/", response_model=StockItemResponse)
def create_stock_item(item: StockItemCreate, db: Session = Depends(get_db)):
    """Create a new stock item"""
    # Check if item code already exists
    existing = db.query(StockItem).filter(StockItem.item_code == item.item_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Item code already exists")
    
    db_item = StockItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/items/{item_id}", response_model=StockItemResponse)
def get_stock_item(item_id: int, db: Session = Depends(get_db)):
    """Get a specific stock item with current stock"""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get current stock
    stock = db.query(
        func.coalesce(func.sum(StockCurrent.current_quantity), 0).label('current_stock'),
        func.coalesce(func.sum(StockCurrent.reserved_quantity), 0).label('reserved_stock'),
        func.coalesce(func.sum(StockCurrent.current_quantity - StockCurrent.reserved_quantity), 0).label('available_stock')
    ).filter(StockCurrent.stock_item_id == item_id).first()
    
    item_dict = item.__dict__.copy()
    if stock:
        item_dict['current_stock'] = stock.current_stock
        item_dict['reserved_stock'] = stock.reserved_stock
        item_dict['available_stock'] = stock.available_stock
    
    return StockItemResponse(**item_dict)

@router.put("/items/{item_id}", response_model=StockItemResponse)
def update_stock_item(item_id: int, item_update: StockItemCreate, db: Session = Depends(get_db)):
    """Update a stock item"""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for field, value in item_update.dict().items():
        setattr(item, field, value)
    
    db.commit()
    db.refresh(item)
    return item

# Stock Movements endpoints
@router.get("/movements/", response_model=List[StockMovementResponse])
def list_stock_movements(
    item_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List stock movements with filters"""
    query = db.query(
        StockMovement,
        StockItem.item_name,
        StockItem.item_code,
        StockLocation.name.label('source_location_name'),
        StockLocation.name.label('destination_location_name')
    ).join(StockItem).outerjoin(
        StockLocation, StockMovement.source_location_id == StockLocation.id
    ).outerjoin(
        StockLocation, StockMovement.destination_location_id == StockLocation.id
    )
    
    if item_id:
        query = query.filter(StockMovement.stock_item_id == item_id)
    
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    
    if date_from:
        query = query.filter(StockMovement.movement_date >= date_from)
    
    if date_to:
        query = query.filter(StockMovement.movement_date <= date_to)
    
    query = query.order_by(StockMovement.movement_date.desc()).limit(limit)
    
    results = query.all()
    
    movements = []
    for movement, item_name, item_code, source_name, dest_name in results:
        movement_dict = movement.__dict__.copy()
        movement_dict['item_name'] = item_name
        movement_dict['item_code'] = item_code
        movement_dict['source_location_name'] = source_name
        movement_dict['destination_location_name'] = dest_name
        
        if movement.printer_id:
            printer = db.query(Printer).filter(Printer.id == movement.printer_id).first()
            if printer:
                movement_dict['printer_info'] = f"{printer.brand} {printer.model} ({printer.asset_tag})"
        
        movements.append(StockMovementResponse(**movement_dict))
    
    return movements

@router.post("/movements/", response_model=StockMovementResponse)
def create_stock_movement(movement: StockMovementCreate, db: Session = Depends(get_db)):
    """Create a new stock movement and update current stock"""
    # Validate stock item exists
    item = db.query(StockItem).filter(StockItem.id == movement.stock_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    # Calculate total cost
    total_cost = movement.quantity * movement.unit_cost
    
    # Create movement record
    db_movement = StockMovement(
        **movement.dict(),
        total_cost=total_cost
    )
    db.add(db_movement)
    
    # Update current stock based on movement type
    if movement.movement_type == "in":
        # Stock in - increase stock at destination location
        location_id = movement.destination_location_id or 1  # Default to main warehouse
        _update_current_stock(db, movement.stock_item_id, location_id, movement.quantity)
    
    elif movement.movement_type == "out":
        # Stock out - decrease stock at source location
        location_id = movement.source_location_id or 1
        _update_current_stock(db, movement.stock_item_id, location_id, -movement.quantity)
    
    elif movement.movement_type == "transfer":
        # Transfer - decrease at source, increase at destination
        if movement.source_location_id:
            _update_current_stock(db, movement.stock_item_id, movement.source_location_id, -movement.quantity)
        if movement.destination_location_id:
            _update_current_stock(db, movement.stock_item_id, movement.destination_location_id, movement.quantity)
    
    elif movement.movement_type == "adjustment":
        # Adjustment - set to specific quantity or adjust by quantity
        location_id = movement.destination_location_id or movement.source_location_id or 1
        _update_current_stock(db, movement.stock_item_id, location_id, movement.quantity)
    
    db.commit()
    db.refresh(db_movement)
    
    return db_movement

def _update_current_stock(db: Session, stock_item_id: int, location_id: int, quantity_change: int):
    """Update current stock for a specific item and location"""
    stock_current = db.query(StockCurrent).filter(
        and_(
            StockCurrent.stock_item_id == stock_item_id,
            StockCurrent.location_id == location_id
        )
    ).first()
    
    if stock_current:
        stock_current.current_quantity += quantity_change
        stock_current.last_movement_date = datetime.utcnow()
        stock_current.updated_at = datetime.utcnow()
    else:
        # Create new stock record
        stock_current = StockCurrent(
            stock_item_id=stock_item_id,
            location_id=location_id,
            current_quantity=max(0, quantity_change),  # Don't allow negative stock
            reserved_quantity=0,
            last_movement_date=datetime.utcnow()
        )
        db.add(stock_current)

# Stock Reports and Analytics
@router.get("/reports/summary")
def get_stock_summary(db: Session = Depends(get_db)):
    """Get stock summary with key metrics"""
    # Total items
    total_items = db.query(StockItem).filter(StockItem.is_active == True).count()
    
    # Low stock items
    low_stock_query = db.query(
        StockItem,
        func.coalesce(func.sum(StockCurrent.current_quantity), 0).label('current_stock')
    ).outerjoin(StockCurrent).group_by(StockItem.id).having(
        func.coalesce(func.sum(StockCurrent.current_quantity), 0) <= StockItem.minimum_stock
    )
    low_stock_items = low_stock_query.count()
    
    # Items by type
    items_by_type = db.query(
        StockItem.item_type,
        func.count(StockItem.id).label('count')
    ).filter(StockItem.is_active == True).group_by(StockItem.item_type).all()
    
    # Recent movements (last 7 days)
    from datetime import timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_movements = db.query(StockMovement).filter(
        StockMovement.movement_date >= week_ago
    ).count()
    
    # Total stock value
    total_value = db.query(
        func.sum(StockCurrent.current_quantity * StockItem.cost_per_unit)
    ).join(StockItem).scalar() or 0
    
    return {
        "total_items": total_items,
        "low_stock_items": low_stock_items,
        "total_stock_value": round(total_value, 2),
        "recent_movements_7days": recent_movements,
        "items_by_type": [{"type": row.item_type, "count": row.count} for row in items_by_type]
    }

@router.get("/reports/low-stock")
def get_low_stock_report(db: Session = Depends(get_db)):
    """Get items with low stock levels"""
    query = db.query(
        StockItem,
        func.coalesce(func.sum(StockCurrent.current_quantity), 0).label('current_stock')
    ).outerjoin(StockCurrent).group_by(StockItem.id).having(
        func.coalesce(func.sum(StockCurrent.current_quantity), 0) <= StockItem.minimum_stock
    ).filter(StockItem.is_active == True)
    
    results = query.all()
    
    low_stock_items = []
    for item, current_stock in results:
        low_stock_items.append({
            "item_id": item.id,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "item_type": item.item_type,
            "current_stock": current_stock,
            "minimum_stock": item.minimum_stock,
            "shortage": item.minimum_stock - current_stock,
            "supplier": item.supplier,
            "cost_per_unit": item.cost_per_unit
        })
    
    return low_stock_items