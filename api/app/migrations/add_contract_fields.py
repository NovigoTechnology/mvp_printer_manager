"""Add new fields to lease_contracts table

Revision ID: add_contract_fields
Revises: 
Create Date: 2025-11-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_contract_fields'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add new fields to lease_contracts table
    op.add_column('lease_contracts', sa.Column('contact_position', sa.String(), nullable=True))
    op.add_column('lease_contracts', sa.Column('priority', sa.String(), nullable=False, server_default='medium'))
    op.add_column('lease_contracts', sa.Column('internal_notes', sa.Text(), nullable=True))
    op.add_column('lease_contracts', sa.Column('special_conditions', sa.Text(), nullable=True))

def downgrade():
    # Remove the added fields
    op.drop_column('lease_contracts', 'special_conditions')
    op.drop_column('lease_contracts', 'internal_notes')
    op.drop_column('lease_contracts', 'priority')
    op.drop_column('lease_contracts', 'contact_position')