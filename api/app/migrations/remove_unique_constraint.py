"""Remove unique constraint for printer month year

Revision ID: remove_unique_printer_month
Revises: 
Create Date: 2025-10-29 16:35:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'remove_unique_printer_month'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Remove the unique constraint to allow multiple counter records per month"""
    # Drop the unique constraint
    op.drop_constraint('unique_printer_month_year', 'monthly_counters', type_='unique')

def downgrade() -> None:
    """Restore the unique constraint"""
    # Recreate the unique constraint
    op.create_unique_constraint(
        'unique_printer_month_year', 
        'monthly_counters', 
        ['printer_id', 'year', 'month']
    )