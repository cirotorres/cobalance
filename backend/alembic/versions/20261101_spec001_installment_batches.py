"""SPEC001: lote transacional e idempotência por usuário.

Revision ID: 20261101_spec001
Revises: (raiz isolada; versions/ vazio no baseline)

Esta revision só deve ser aplicada depois de validar o schema legado e
alembic_version do banco de destino. Testes usam banco descartável.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261101_spec001"
down_revision = None
branch_labels = None
depends_on = None

LEGACY_REQUIRED = {
    "users": {"id", "email", "name", "password_hash", "is_admin"},
    "participants": {"id", "user_id", "name", "color"},
    "financial_entries": {
        "id", "user_id", "participant_id", "amount", "transaction_date",
        "description", "source", "is_reviewed", "installment_number",
        "installment_total", "created_at", "updated_at",
    },
}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    for table, required_columns in LEGACY_REQUIRED.items():
        if table not in tables:
            raise RuntimeError(f"SPEC001: schema legado ausente: {table}")
        existing = {col["name"] for col in inspector.get_columns(table)}
        if not required_columns <= existing:
            raise RuntimeError(f"SPEC001: colunas legadas ausentes em {table}")
    if "financial_entry_batches" in tables or "batch_id" in {
        col["name"] for col in inspector.get_columns("financial_entries")
    }:
        raise RuntimeError("SPEC001: schema já contém objetos desta migração")

    op.create_table(
        "financial_entry_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_financial_entry_batches_user_key"),
    )
    op.add_column("financial_entries", sa.Column("batch_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_financial_entries_batch_id", "financial_entries", "financial_entry_batches",
        ["batch_id"], ["id"],
    )
    op.create_index("ix_financial_entries_batch_id", "financial_entries", ["batch_id"])


def downgrade() -> None:
    op.drop_index("ix_financial_entries_batch_id", table_name="financial_entries")
    op.drop_constraint("fk_financial_entries_batch_id", "financial_entries", type_="foreignkey")
    op.drop_column("financial_entries", "batch_id")
    op.drop_table("financial_entry_batches")
