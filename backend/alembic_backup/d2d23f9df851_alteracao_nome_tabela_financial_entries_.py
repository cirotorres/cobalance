"""alteracao nome tabela -> financial_entries, e participants.

Revision ID: d2d23f9df851
Revises: 3b6def9f7fa7
Create Date: 2026-04-29 10:24:18.363566

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2d23f9df851'
down_revision: Union[str, Sequence[str], None] = '3b6def9f7fa7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table("participantes", "participants")
    op.rename_table("transactions", "financial_entries")


def downgrade() -> None:
    """Downgrade schema."""
    op.rename_table("participants", "participantes")
    op.rename_table("financial_entries", "transactions")
    
