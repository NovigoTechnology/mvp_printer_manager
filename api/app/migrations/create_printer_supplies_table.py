"""
Migration: Create printer_supplies table
Description: Creates the relationship between printers and stock items
"""

from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
import os
from datetime import datetime

def run_migration():
    """Run the migration to create printer_supplies table"""
    
    # Database connection
    database_url = os.getenv("DATABASE_URL", "postgresql://printer_user:printer_pass@localhost:5432/printer_fleet")
    engine = create_engine(database_url)
    
    metadata = MetaData()
    
    # Define the printer_supplies table
    printer_supplies = Table(
        'printer_supplies',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('printer_id', Integer, ForeignKey('printers.id'), nullable=False),
        Column('stock_item_id', Integer, ForeignKey('stock_items.id'), nullable=False),
        Column('is_primary', Boolean, default=False),
        Column('notes', Text),
        Column('created_at', DateTime(timezone=True), server_default=func.now()),
        Column('updated_at', DateTime(timezone=True), onupdate=func.now()),
        UniqueConstraint('printer_id', 'stock_item_id', name='unique_printer_stock_item')
    )
    
    try:
        # Create the table
        metadata.create_all(engine)
        print(f"✅ Successfully created printer_supplies table at {datetime.now()}")
        
        # Add some sample data if needed
        with engine.connect() as conn:
            # Check if we have any printers and stock items
            from sqlalchemy import text
            printers_result = conn.execute(text("SELECT COUNT(*) FROM printers")).fetchone()
            stock_items_result = conn.execute(text("SELECT COUNT(*) FROM stock_items")).fetchone()
            
            print(f"📊 Found {printers_result[0]} printers and {stock_items_result[0]} stock items")
            
            if printers_result[0] > 0 and stock_items_result[0] > 0:
                print("ℹ️  You can now assign stock items to printers using the API endpoints")
            else:
                print("ℹ️  Create some printers and stock items first, then assign them using the API")
                
    except Exception as e:
        print(f"❌ Error creating printer_supplies table: {e}")
        raise

if __name__ == "__main__":
    print("🚀 Running migration: Create printer_supplies table")
    run_migration()