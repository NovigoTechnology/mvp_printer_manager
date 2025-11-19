"""Add multimoneda support to lease contracts

Revision ID: add_multimoneda_contracts
Revises: 
Create Date: 2024-11-06 14:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_multimoneda_contracts'
down_revision = None
depends_on = None


def upgrade():
    # Agregar columnas de soporte multimoneda a lease_contracts
    op.add_column('lease_contracts', sa.Column('currency', sa.String(), nullable=False, server_default='ARS'))
    op.add_column('lease_contracts', sa.Column('exchange_rate', sa.Float(), nullable=False, server_default='1.0'))
    op.add_column('lease_contracts', sa.Column('cost_bw_per_copy_usd', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('lease_contracts', sa.Column('cost_color_per_copy_usd', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('lease_contracts', sa.Column('fixed_monthly_cost_usd', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('lease_contracts', sa.Column('fixed_annual_cost_usd', sa.Float(), nullable=False, server_default='0.0'))


def downgrade():
    # Remover columnas de soporte multimoneda
    op.drop_column('lease_contracts', 'fixed_annual_cost_usd')
    op.drop_column('lease_contracts', 'fixed_monthly_cost_usd')
    op.drop_column('lease_contracts', 'cost_color_per_copy_usd')
    op.drop_column('lease_contracts', 'cost_bw_per_copy_usd')
    op.drop_column('lease_contracts', 'exchange_rate')
    op.drop_column('lease_contracts', 'currency')