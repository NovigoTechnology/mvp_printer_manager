"""
Script to populate the stock database with sample data for testing
"""
import sys
import os
from datetime import datetime, timedelta
import random

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db import SessionLocal, engine
from app.models import StockLocation, StockItem, StockMovement, StockCurrent

def create_sample_data():
    db = SessionLocal()
    
    try:
        # Create stock locations
        locations = [
            StockLocation(
                name="Depósito Principal",
                description="Depósito central de insumos",
                location_type="warehouse",
                address="Av. Principal 123, Buenos Aires",
                responsible_person="Juan Pérez"
            ),
            StockLocation(
                name="Oficina Norte",
                description="Oficina sucursal norte",
                location_type="office",
                address="Calle Norte 456, Buenos Aires",
                responsible_person="María García"
            ),
            StockLocation(
                name="Oficina Sur",
                description="Oficina sucursal sur",
                location_type="office",
                address="Av. Sur 789, Buenos Aires",
                responsible_person="Carlos Rodriguez"
            ),
            StockLocation(
                name="Mantenimiento",
                description="Área de mantenimiento técnico",
                location_type="maintenance",
                address="Taller 101, Buenos Aires",
                responsible_person="Luis Fernández"
            )
        ]
        
        for location in locations:
            db.add(location)
        db.commit()
        
        # Create stock items
        items = [
            # Toner cartridges
            StockItem(
                item_code="HP-CF410A",
                item_name="Tóner HP 410A Negro",
                item_type="toner",
                brand="HP",
                model="CF410A",
                description="Tóner negro compatible con HP Color LaserJet Pro",
                compatible_printers="HP Color LaserJet Pro M452, M477",
                unit_of_measure="unidad",
                minimum_stock=5,
                maximum_stock=50,
                cost_per_unit=15500.00,
                supplier="Distribuidora HP",
                supplier_code="HP-CF410A-BK",
                storage_location_id=1
            ),
            StockItem(
                item_code="HP-CF411A",
                item_name="Tóner HP 410A Cian",
                item_type="toner",
                brand="HP",
                model="CF411A",
                description="Tóner cian compatible con HP Color LaserJet Pro",
                compatible_printers="HP Color LaserJet Pro M452, M477",
                unit_of_measure="unidad",
                minimum_stock=3,
                maximum_stock=30,
                cost_per_unit=16800.00,
                supplier="Distribuidora HP",
                supplier_code="HP-CF411A-CY",
                storage_location_id=1
            ),
            StockItem(
                item_code="BR-TN660",
                item_name="Tóner Brother TN660",
                item_type="toner",
                brand="Brother",
                model="TN660",
                description="Tóner negro de alto rendimiento Brother",
                compatible_printers="Brother HL-L2300, L2340, L2360",
                unit_of_measure="unidad",
                minimum_stock=4,
                maximum_stock=40,
                cost_per_unit=12300.00,
                supplier="Brother Argentina",
                supplier_code="BR-TN660-HY",
                storage_location_id=1
            ),
            StockItem(
                item_code="OKI-44318608",
                item_name="Tóner OKI Negro C710",
                item_type="toner",
                brand="OKI",
                model="44318608",
                description="Tóner negro para OKI C710",
                compatible_printers="OKI C710, C711",
                unit_of_measure="unidad",
                minimum_stock=2,
                maximum_stock=20,
                cost_per_unit=22400.00,
                supplier="OKI Data",
                supplier_code="OKI-C710-BK",
                storage_location_id=1
            ),
            # Paper
            StockItem(
                item_code="PAP-A4-75",
                item_name="Papel A4 75g Blanco",
                item_type="papel",
                brand="Ledesma",
                model="Office",
                description="Papel blanco A4 75g para impresión",
                compatible_printers="Todas las impresoras",
                unit_of_measure="resma",
                minimum_stock=20,
                maximum_stock=200,
                cost_per_unit=1850.00,
                supplier="Papelera Central",
                supplier_code="LED-A4-75-500",
                storage_location_id=1
            ),
            StockItem(
                item_code="PAP-A4-90",
                item_name="Papel A4 90g Premium",
                item_type="papel",
                brand="Ledesma",
                model="Premium",
                description="Papel blanco A4 90g premium",
                compatible_printers="Todas las impresoras",
                unit_of_measure="resma",
                minimum_stock=10,
                maximum_stock=100,
                cost_per_unit=2150.00,
                supplier="Papelera Central",
                supplier_code="LED-A4-90-500",
                storage_location_id=1
            ),
            # Spare parts
            StockItem(
                item_code="HP-RL1-1443",
                item_name="Rodillo Pickup HP LaserJet",
                item_type="repuesto",
                brand="HP",
                model="RL1-1443",
                description="Rodillo de alimentación de papel",
                compatible_printers="HP LaserJet P2015, P2014, M2727",
                unit_of_measure="unidad",
                minimum_stock=2,
                maximum_stock=10,
                cost_per_unit=3500.00,
                supplier="Repuestos Tech",
                supplier_code="HP-PICKUP-RL1",
                storage_location_id=1
            ),
            StockItem(
                item_code="BR-LY6754001",
                item_name="Fusor Brother HL-L2340",
                item_type="repuesto",
                brand="Brother",
                model="LY6754001",
                description="Unidad fusora completa",
                compatible_printers="Brother HL-L2340, L2360, L2380",
                unit_of_measure="unidad",
                minimum_stock=1,
                maximum_stock=5,
                cost_per_unit=8900.00,
                supplier="Brother Parts",
                supplier_code="BR-FUSOR-L2340",
                storage_location_id=1
            ),
            # Maintenance items
            StockItem(
                item_code="MANT-WD40",
                item_name="Lubricante WD-40",
                item_type="mantenimiento",
                brand="WD-40",
                model="Classic",
                description="Lubricante multiuso para mantenimiento",
                compatible_printers="Mantenimiento general",
                unit_of_measure="lata",
                minimum_stock=3,
                maximum_stock=15,
                cost_per_unit=1200.00,
                supplier="Ferretería Industrial",
                supplier_code="WD40-400ML",
                storage_location_id=4
            ),
            StockItem(
                item_code="MANT-ALCOHOL",
                item_name="Alcohol Isopropílico",
                item_type="mantenimiento",
                brand="Genérico",
                model="99%",
                description="Alcohol isopropílico para limpieza",
                compatible_printers="Limpieza general",
                unit_of_measure="litro",
                minimum_stock=2,
                maximum_stock=10,
                cost_per_unit=1800.00,
                supplier="Químicos SA",
                supplier_code="ISO-ALCOHOL-1L",
                storage_location_id=4
            )
        ]
        
        for item in items:
            db.add(item)
        db.commit()
        
        # Create initial stock with random quantities
        for item in items:
            initial_quantity = random.randint(max(item.minimum_stock + 1, 1), max(item.maximum_stock - 5, item.minimum_stock + 2))
            
            # Create initial stock entry
            stock_current = StockCurrent(
                stock_item_id=item.id,
                location_id=item.storage_location_id or 1,
                current_quantity=initial_quantity,
                reserved_quantity=0,
                last_movement_date=datetime.utcnow() - timedelta(days=random.randint(1, 30))
            )
            db.add(stock_current)
            
            # Create initial stock movement
            movement = StockMovement(
                stock_item_id=item.id,
                movement_type="in",
                quantity=initial_quantity,
                unit_cost=item.cost_per_unit,
                total_cost=initial_quantity * item.cost_per_unit,
                reference_type="initial_stock",
                destination_location_id=item.storage_location_id or 1,
                notes="Stock inicial del sistema",
                moved_by="Sistema",
                movement_date=datetime.utcnow() - timedelta(days=random.randint(1, 30))
            )
            db.add(movement)
        
        db.commit()
        
        # Create some sample movements over the last weeks
        items_list = db.query(StockItem).all()
        
        # Simulate outgoing movements (usage)
        for _ in range(20):
            item = random.choice(items_list)
            stock = db.query(StockCurrent).filter(
                StockCurrent.stock_item_id == item.id
            ).first()
            
            if stock and stock.current_quantity > 2:
                quantity_out = random.randint(1, min(3, stock.current_quantity - 1))
                
                movement = StockMovement(
                    stock_item_id=item.id,
                    movement_type="out",
                    quantity=quantity_out,
                    unit_cost=item.cost_per_unit,
                    total_cost=quantity_out * item.cost_per_unit,
                    reference_type="usage",
                    source_location_id=stock.location_id,
                    notes=f"Consumo normal - {random.choice(['Impresora oficina', 'Mantenimiento', 'Reposición'])}",
                    moved_by=random.choice(["Juan Pérez", "María García", "Carlos Rodriguez", "Luis Fernández"]),
                    movement_date=datetime.utcnow() - timedelta(days=random.randint(1, 15))
                )
                db.add(movement)
                
                # Update stock
                stock.current_quantity -= quantity_out
                stock.last_movement_date = movement.movement_date
                stock.updated_at = datetime.utcnow()
        
        # Simulate some transfers between locations
        for _ in range(5):
            item = random.choice(items_list)
            source_stock = db.query(StockCurrent).filter(
                StockCurrent.stock_item_id == item.id,
                StockCurrent.current_quantity > 1
            ).first()
            
            if source_stock:
                quantity_transfer = random.randint(1, min(2, source_stock.current_quantity - 1))
                dest_location = random.choice([2, 3])  # Office locations
                
                movement = StockMovement(
                    stock_item_id=item.id,
                    movement_type="transfer",
                    quantity=quantity_transfer,
                    unit_cost=item.cost_per_unit,
                    total_cost=quantity_transfer * item.cost_per_unit,
                    reference_type="transfer",
                    source_location_id=source_stock.location_id,
                    destination_location_id=dest_location,
                    notes="Transferencia entre oficinas",
                    moved_by=random.choice(["Juan Pérez", "María García", "Carlos Rodriguez"]),
                    movement_date=datetime.utcnow() - timedelta(days=random.randint(1, 10))
                )
                db.add(movement)
                
                # Update source stock
                source_stock.current_quantity -= quantity_transfer
                source_stock.last_movement_date = movement.movement_date
                source_stock.updated_at = datetime.utcnow()
                
                # Create or update destination stock
                dest_stock = db.query(StockCurrent).filter(
                    StockCurrent.stock_item_id == item.id,
                    StockCurrent.location_id == dest_location
                ).first()
                
                if dest_stock:
                    dest_stock.current_quantity += quantity_transfer
                    dest_stock.last_movement_date = movement.movement_date
                    dest_stock.updated_at = datetime.utcnow()
                else:
                    dest_stock = StockCurrent(
                        stock_item_id=item.id,
                        location_id=dest_location,
                        current_quantity=quantity_transfer,
                        reserved_quantity=0,
                        last_movement_date=movement.movement_date
                    )
                    db.add(dest_stock)
        
        db.commit()
        
        print("✅ Sample data created successfully!")
        print(f"Created {len(locations)} locations")
        print(f"Created {len(items)} items")
        print("Created initial stock and sample movements")
        
        # Print summary
        total_items = db.query(StockItem).count()
        total_locations = db.query(StockLocation).count()
        total_movements = db.query(StockMovement).count()
        
        print(f"\n📊 Database Summary:")
        print(f"  - Total Locations: {total_locations}")
        print(f"  - Total Items: {total_items}")
        print(f"  - Total Movements: {total_movements}")
        
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_data()