"""Add companies and contract_companies tables

Revision ID: add_companies_and_contract_companies
Revises: 
Create Date: 2025-11-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_companies_and_contract_companies'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create companies table
    op.create_table('companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('legal_name', sa.String(length=255), nullable=True),
        sa.Column('tax_id', sa.String(length=50), nullable=False),
        sa.Column('business_type', sa.String(length=100), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True, server_default='Argentina'),
        sa.Column('contact_person', sa.String(length=255), nullable=True),
        sa.Column('contact_position', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('mobile', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('size', sa.String(length=50), nullable=True, server_default='medium'),
        sa.Column('annual_revenue', sa.Float(), nullable=True),
        sa.Column('employee_count', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='active'),
        sa.Column('priority', sa.String(length=20), nullable=True, server_default='medium'),
        sa.Column('credit_rating', sa.String(length=20), nullable=True),
        sa.Column('payment_terms', sa.String(length=100), nullable=True, server_default='30 days'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_companies_id', 'companies', ['id'], unique=False)
    op.create_index('ix_companies_name', 'companies', ['name'], unique=False)
    op.create_index('ix_companies_tax_id', 'companies', ['tax_id'], unique=True)

    # Create contract_companies table (many-to-many)
    op.create_table('contract_companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=True, server_default='client'),
        sa.Column('participation_percentage', sa.Float(), nullable=True, server_default='100.0'),
        sa.Column('is_primary', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['contract_id'], ['lease_contracts.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'company_id', name='unique_contract_company')
    )
    op.create_index('ix_contract_companies_id', 'contract_companies', ['id'], unique=False)

def downgrade():
    # Drop contract_companies table
    op.drop_index('ix_contract_companies_id', table_name='contract_companies')
    op.drop_table('contract_companies')
    
    # Drop companies table
    op.drop_index('ix_companies_tax_id', table_name='companies')
    op.drop_index('ix_companies_name', table_name='companies')
    op.drop_index('ix_companies_id', table_name='companies')
    op.drop_table('companies')