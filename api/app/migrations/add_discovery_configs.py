"""add discovery configs table

Revision ID: add_discovery_configs
Revises: 
Create Date: 2025-11-02 21:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_discovery_configs'
down_revision = None
depends_on = None

def upgrade():
    # Create discovery_configs table
    op.create_table(
        'discovery_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('ip_ranges', sa.Text(), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discovery_configs_id'), 'discovery_configs', ['id'], unique=False)
    
    # Insert some default configurations
    op.execute("""
        INSERT INTO discovery_configs (name, ip_ranges, description, is_active) VALUES 
        ('Red Oficina Principal', '10.10.9.1-10.10.9.100', 'Rango principal de impresoras de oficina', true),
        ('Red Planta Baja', '192.168.1.1-192.168.1.50', 'Impresoras ubicadas en planta baja', true),
        ('Red Primer Piso', '192.168.2.1-192.168.2.50', 'Impresoras ubicadas en primer piso', true)
    """)

def downgrade():
    op.drop_index(op.f('ix_discovery_configs_id'), table_name='discovery_configs')
    op.drop_table('discovery_configs')