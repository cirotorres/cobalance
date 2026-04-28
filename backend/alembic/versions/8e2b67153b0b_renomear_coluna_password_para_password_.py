"""renomear coluna password para password_hash em users

Revision ID: 8e2b67153b0b
Revises: fe546d4a7ba3
Create Date: 2026-04-28 00:16:10.554421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e2b67153b0b'
down_revision: Union[str, Sequence[str], None] = 'fe546d4a7ba3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("users", "password", new_column_name="password_hash")
    


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("users", "password_hash", new_column_name="password")
    
