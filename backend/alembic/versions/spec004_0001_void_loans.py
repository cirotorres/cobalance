"""SPEC004: anulação lógica auditável de empréstimo (sem exclusão física).

Revision ID: spec004_0001
Revises: spec003_0001
"""
from alembic import op
import sqlalchemy as sa

revision = "spec004_0001"
down_revision = "spec003_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("loans", sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("loans", sa.Column("void_reason", sa.String(length=300), nullable=True))
    op.drop_constraint("ck_loans_status", "loans", type_="check")
    op.create_check_constraint("ck_loans_status", "loans",
                               "status IN ('DRAFT','ACTIVE','SETTLED','CANCELLED','VOIDED')")
    op.drop_constraint("ck_loans_funded", "loans", type_="check")
    op.create_check_constraint("ck_loans_funded", "loans",
                               "status IN ('DRAFT','CANCELLED','VOIDED') OR funded_on IS NOT NULL")
    op.create_check_constraint(
        "ck_loans_void_audit", "loans",
        "status <> 'VOIDED' OR (voided_at IS NOT NULL AND NULLIF(BTRIM(void_reason), '') IS NOT NULL)",
    )


def downgrade() -> None:
    # Downgrade não pode descartar audit trail de contratos já anulados.
    conn = op.get_bind()
    if conn.execute(sa.text("SELECT 1 FROM loans WHERE status = 'VOIDED' LIMIT 1")).first():
        raise RuntimeError("Downgrade bloqueado: há contratos VOIDED com auditoria a preservar.")
    op.drop_constraint("ck_loans_void_audit", "loans", type_="check")
    op.drop_constraint("ck_loans_status", "loans", type_="check")
    op.create_check_constraint("ck_loans_status", "loans",
                               "status IN ('DRAFT','ACTIVE','SETTLED','CANCELLED')")
    op.drop_constraint("ck_loans_funded", "loans", type_="check")
    op.create_check_constraint("ck_loans_funded", "loans",
                               "status = 'DRAFT' OR status = 'CANCELLED' OR funded_on IS NOT NULL")
    op.drop_column("loans", "void_reason")
    op.drop_column("loans", "voided_at")
