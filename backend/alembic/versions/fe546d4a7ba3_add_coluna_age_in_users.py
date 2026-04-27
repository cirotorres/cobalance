"""add coluna age in users

Revision ID: fe546d4a7ba3
Revises: 
Create Date: 2026-04-27 13:44:38.690248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fe546d4a7ba3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column("users", sa.Column("age", sa.Integer))


def downgrade() -> None:
    """Downgrade schema."""
    pass
