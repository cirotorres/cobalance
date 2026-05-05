"""nova tabela lançamentos

Revision ID: 3b6def9f7fa7
Revises: 91bb65954eb0
Create Date: 2026-04-28 13:09:28.889287

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3b6def9f7fa7'
down_revision: Union[str, Sequence[str], None] = '91bb65954eb0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('participant_id', sa.Integer(), sa.ForeignKey('participantes.id'), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('is_reviewed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('installment_number', sa.Integer(), nullable=True),
        sa.Column('installment_total', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('transactions')
