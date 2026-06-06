"""add coluna colors in participants

Revision ID: ebd34eb8efb2
Revises: d2d23f9df851
Create Date: 2026-05-14 11:57:52.289557

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ebd34eb8efb2'
down_revision: Union[str, Sequence[str], None] = 'd2d23f9df851'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("participants", sa.Column('color', sa.VARCHAR(7), nullable=True))


def downgrade() -> None:
    op.drop_column("participants", "color")
