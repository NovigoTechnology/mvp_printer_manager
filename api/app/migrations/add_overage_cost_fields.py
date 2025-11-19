"""
Migración: Agregar campos de costos de páginas excedentes
Fecha: 11 de noviembre de 2025
Descripción: Agrega campos específicos para costos de páginas excedentes en contratos
"""

from sqlalchemy import Column, Float, text
from sqlalchemy.sql import text

def upgrade(db_session):
    """Agregar campos de costos de páginas excedentes al modelo LeaseContract"""
    try:
        # Agregar campos de costos excedentes en moneda base
        db_session.execute(text("""
            ALTER TABLE lease_contracts 
            ADD COLUMN overage_cost_bw FLOAT DEFAULT 0.0
        """))
        
        db_session.execute(text("""
            ALTER TABLE lease_contracts 
            ADD COLUMN overage_cost_color FLOAT DEFAULT 0.0
        """))
        
        # Agregar campos de costos excedentes en USD
        db_session.execute(text("""
            ALTER TABLE lease_contracts 
            ADD COLUMN overage_cost_bw_usd FLOAT DEFAULT 0.0
        """))
        
        db_session.execute(text("""
            ALTER TABLE lease_contracts 
            ADD COLUMN overage_cost_color_usd FLOAT DEFAULT 0.0
        """))
        
        db_session.commit()
        print("✅ Migración de campos de costos excedentes completada exitosamente")
        
    except Exception as e:
        db_session.rollback()
        print(f"❌ Error en la migración de costos excedentes: {e}")
        raise

def downgrade(db_session):
    """Remover campos de costos de páginas excedentes"""
    try:
        # Remover campos de costos excedentes
        db_session.execute(text("ALTER TABLE lease_contracts DROP COLUMN overage_cost_bw"))
        db_session.execute(text("ALTER TABLE lease_contracts DROP COLUMN overage_cost_color"))
        db_session.execute(text("ALTER TABLE lease_contracts DROP COLUMN overage_cost_bw_usd"))
        db_session.execute(text("ALTER TABLE lease_contracts DROP COLUMN overage_cost_color_usd"))
        
        db_session.commit()
        print("✅ Rollback de campos de costos excedentes completado")
        
    except Exception as e:
        db_session.rollback()
        print(f"❌ Error en el rollback de costos excedentes: {e}")
        raise

if __name__ == "__main__":
    # Ejecutar migración directamente si se ejecuta el archivo
    from ...db import get_db_session
    
    session = get_db_session()
    try:
        print("🚀 Ejecutando migración de costos excedentes...")
        upgrade(session)
        print("🎉 Migración completada exitosamente")
    except Exception as e:
        print(f"💥 Error en la migración: {e}")
    finally:
        session.close()