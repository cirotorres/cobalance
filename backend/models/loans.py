"""SPEC003 — domínio Empréstimos pessoais.

Tabelas autocontidas; NÃO reutilizam `participants`/`financial_entries`.
Dinheiro sempre em centavos inteiros (BigInteger); taxas em NUMERIC.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, ForeignKeyConstraint,
    Index, Integer, JSON, Numeric, String, Text, UniqueConstraint, text,
)

from db.database import Base


def _now():
    return datetime.now(timezone.utc)


def _ts():
    return Column(DateTime(timezone=True), default=_now, nullable=False)


class UserModulePreference(Base):
    __tablename__ = "user_module_preferences"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    cards_enabled = Column(Boolean, nullable=False, default=True)
    loans_enabled = Column(Boolean, nullable=False, default=False)
    default_module = Column(String(10), nullable=False, default="cards")
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    __table_args__ = (
        CheckConstraint("default_module IN ('cards','loans')", name="ck_ump_default_module"),
        CheckConstraint("cards_enabled OR loans_enabled", name="ck_ump_one_enabled"),
        CheckConstraint(
            "(default_module = 'cards' AND cards_enabled) OR (default_module = 'loans' AND loans_enabled)",
            name="ck_ump_default_enabled",
        ),
    )


class LoanBorrower(Base):
    __tablename__ = "loan_borrowers"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(120), nullable=False)
    name_normalized = Column(String(120), nullable=False)
    contact = Column(String(120), nullable=True)
    note = Column(String(500), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_loan_borrowers_id_user"),
        Index("ix_loan_borrowers_user", "user_id"),
        Index(
            "uq_loan_borrowers_user_name_active", "user_id", "name_normalized",
            unique=True, postgresql_where=text("archived_at IS NULL"),
        ),
    )


class LoanPixAccount(Base):
    __tablename__ = "loan_pix_accounts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    label = Column(String(60), nullable=False)
    institution = Column(String(60), nullable=True)
    holder_name = Column(String(60), nullable=False)
    city = Column(String(40), nullable=False)
    key_type = Column(String(10), nullable=False)
    key = Column(String(77), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    __table_args__ = (
        CheckConstraint("NOT is_default OR is_active", name="ck_pix_default_active"),
        CheckConstraint("key_type IN ('cpf','cnpj','email','phone','evp')", name="ck_pix_key_type"),
        Index("uq_pix_one_default", "user_id", unique=True, postgresql_where=text("is_default")),
        Index("ix_pix_user", "user_id"),
    )


class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    borrower_id = Column(Integer, nullable=False)
    description = Column(String(200), nullable=True)
    principal_cents = Column(BigInteger, nullable=False)
    interest_method = Column(String(12), nullable=False)  # fixed_addon | price
    rate = Column(Numeric(12, 6), nullable=False)          # percentual (ex.: 5.000000)
    rate_unit = Column(String(32), nullable=False)          # per_installment_on_principal | monthly_effective
    installment_count = Column(Integer, nullable=False)
    frequency = Column(String(12), nullable=False)          # monthly | biweekly | every_x_days | manual
    interval_days = Column(Integer, nullable=True)
    start_on = Column(Date, nullable=False)
    first_due_on = Column(Date, nullable=False)
    terms_hash = Column(String(64), nullable=False)
    status = Column(String(10), nullable=False, default="DRAFT")
    voided_at = Column(DateTime(timezone=True), nullable=True)
    void_reason = Column(String(300), nullable=True)
    funded_on = Column(Date, nullable=True)
    funding_method = Column(String(20), nullable=True)
    funding_source = Column(String(120), nullable=True)
    funding_note = Column(String(500), nullable=True)
    current_version = Column(Integer, nullable=False, default=1)
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    __table_args__ = (
        # FK composta garante que o tomador pertence ao MESMO usuário.
        ForeignKeyConstraint(
            ["borrower_id", "user_id"], ["loan_borrowers.id", "loan_borrowers.user_id"],
            name="fk_loans_borrower_owner", ondelete="RESTRICT",
        ),
        CheckConstraint("principal_cents > 0", name="ck_loans_principal_pos"),
        CheckConstraint("rate >= 0", name="ck_loans_rate_nonneg"),
        CheckConstraint(
            "(interest_method = 'fixed_addon' AND rate_unit = 'per_installment_on_principal') OR "
            "(interest_method = 'price' AND rate_unit = 'monthly_effective')",
            name="ck_loans_rate_unit",
        ),
        CheckConstraint("installment_count BETWEEN 1 AND 120", name="ck_loans_n"),
        CheckConstraint("interest_method IN ('fixed_addon','price')", name="ck_loans_method"),
        CheckConstraint("status IN ('DRAFT','ACTIVE','SETTLED','CANCELLED','VOIDED')", name="ck_loans_status"),
        CheckConstraint("frequency IN ('monthly','biweekly','every_x_days','manual')", name="ck_loans_freq"),
        CheckConstraint("frequency <> 'every_x_days' OR interval_days > 0", name="ck_loans_interval"),
        CheckConstraint("status IN ('DRAFT','CANCELLED','VOIDED') OR funded_on IS NOT NULL", name="ck_loans_funded"),
        CheckConstraint("status <> 'VOIDED' OR (voided_at IS NOT NULL AND "
                        "NULLIF(BTRIM(void_reason), '') IS NOT NULL)", name="ck_loans_void_audit"),
        UniqueConstraint("id", "user_id", name="uq_loans_id_user"),
        Index("ix_loans_user_borrower", "user_id", "borrower_id"),
    )


class LoanScheduleVersion(Base):
    __tablename__ = "loan_schedule_versions"
    id = Column(Integer, primary_key=True)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=False)
    number = Column(Integer, nullable=False)
    reason = Column(String(40), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    receipt_id = Column(Integer, ForeignKey("loan_receipts.id", ondelete="RESTRICT"), nullable=True)
    created_at = _ts()
    __table_args__ = (UniqueConstraint("loan_id", "number", name="uq_schedule_version"),)


class LoanInstallment(Base):
    __tablename__ = "loan_installments"
    id = Column(Integer, primary_key=True)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=False)
    version = Column(Integer, nullable=False)
    number = Column(Integer, nullable=False)
    due_on = Column(Date, nullable=False)
    principal_cents = Column(BigInteger, nullable=False)
    interest_cents = Column(BigInteger, nullable=False)
    adjustment_cents = Column(BigInteger, nullable=False, default=0)
    paid_principal_cents = Column(BigInteger, nullable=False, default=0)
    paid_interest_cents = Column(BigInteger, nullable=False, default=0)
    paid_adjustment_cents = Column(BigInteger, nullable=False, default=0)
    status = Column(String(16), nullable=False, default="PENDING")
    is_active = Column(Boolean, nullable=False, default=True)
    # versão de cronograma que substituiu esta parcela (NULL = nunca substituída / reativada)
    superseded_in_version = Column(Integer, nullable=True)
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    __table_args__ = (
        CheckConstraint("is_active OR superseded_in_version IS NOT NULL", name="ck_inst_inactive_has_version"),
        UniqueConstraint("loan_id", "version", "number", name="uq_installment_version_number"),
        CheckConstraint("principal_cents >= 0 AND interest_cents >= 0 AND adjustment_cents >= 0", name="ck_inst_nonneg"),
        CheckConstraint(
            "paid_principal_cents BETWEEN 0 AND principal_cents AND "
            "paid_interest_cents BETWEEN 0 AND interest_cents AND "
            "paid_adjustment_cents BETWEEN 0 AND adjustment_cents",
            name="ck_inst_paid_bounds",
        ),
        CheckConstraint("status IN ('PENDING','PARTIALLY_PAID','PAID')", name="ck_inst_status"),
        Index("ix_inst_loan_due", "loan_id", "due_on"),
    )

    @property
    def total_cents(self) -> int:
        return self.principal_cents + self.interest_cents + self.adjustment_cents

    @property
    def paid_cents(self) -> int:
        return self.paid_principal_cents + self.paid_interest_cents + self.paid_adjustment_cents

    @property
    def remaining_cents(self) -> int:
        return self.total_cents - self.paid_cents


class LoanReceipt(Base):
    __tablename__ = "loan_receipts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    borrower_id = Column(Integer, nullable=False)
    received_on = Column(Date, nullable=False)
    amount_cents = Column(BigInteger, nullable=False)
    kind = Column(String(20), nullable=False)  # full | partial | price_amortization
    method = Column(String(20), nullable=False, default="pix")
    pix_account_id = Column(Integer, ForeignKey("loan_pix_accounts.id", ondelete="RESTRICT"), nullable=True)
    note = Column(String(500), nullable=True)
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    reversal_reason = Column(String(300), nullable=True)
    created_at = _ts()
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_receipt_amount_pos"),
        CheckConstraint("kind IN ('full','partial','price_amortization')", name="ck_receipt_kind"),
        ForeignKeyConstraint(
            ["borrower_id", "user_id"], ["loan_borrowers.id", "loan_borrowers.user_id"],
            name="fk_receipt_borrower_owner", ondelete="RESTRICT",
        ),
        Index("ix_receipts_user_received", "user_id", "received_on"),
    )


class LoanReceiptAllocation(Base):
    __tablename__ = "loan_receipt_allocations"
    id = Column(Integer, primary_key=True)
    receipt_id = Column(Integer, ForeignKey("loan_receipts.id", ondelete="RESTRICT"), nullable=False)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=False)
    installment_id = Column(Integer, ForeignKey("loan_installments.id", ondelete="RESTRICT"), nullable=True)
    installment_version = Column(Integer, nullable=True)
    kind = Column(String(20), nullable=False)  # installment | anticipation | amortization
    principal_cents = Column(BigInteger, nullable=False, default=0)
    interest_cents = Column(BigInteger, nullable=False, default=0)
    adjustment_cents = Column(BigInteger, nullable=False, default=0)
    __table_args__ = (
        CheckConstraint("principal_cents >= 0 AND interest_cents >= 0 AND adjustment_cents >= 0", name="ck_alloc_nonneg"),
        CheckConstraint("principal_cents + interest_cents + adjustment_cents > 0", name="ck_alloc_pos"),
        CheckConstraint("kind IN ('installment','anticipation','amortization')", name="ck_alloc_kind"),
        CheckConstraint("kind = 'amortization' OR installment_id IS NOT NULL", name="ck_alloc_inst_required"),
        Index("ix_alloc_receipt", "receipt_id"),
        Index("ix_alloc_installment", "installment_id"),
    )


class LoanAdjustment(Base):
    __tablename__ = "loan_adjustments"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=False)
    installment_id = Column(Integer, ForeignKey("loan_installments.id", ondelete="RESTRICT"), nullable=False)
    amount_cents = Column(BigInteger, nullable=False)
    reason = Column(String(300), nullable=False)
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = _ts()
    __table_args__ = (CheckConstraint("amount_cents > 0", name="ck_adj_pos"),)


class LoanCharge(Base):
    __tablename__ = "loan_charges"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    borrower_id = Column(Integer, nullable=False)
    pix_account_id = Column(Integer, ForeignKey("loan_pix_accounts.id", ondelete="RESTRICT"), nullable=False)
    pix_key_snapshot = Column(String(77), nullable=False)
    holder_name_snapshot = Column(String(60), nullable=False)
    city_snapshot = Column(String(40), nullable=False)
    total_cents = Column(BigInteger, nullable=False)
    brcode = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(10), nullable=False, default="GENERATED")
    shared_at = Column(DateTime(timezone=True), nullable=True)
    created_at = _ts()
    __table_args__ = (
        CheckConstraint("total_cents > 0", name="ck_charge_total_pos"),
        CheckConstraint("status IN ('GENERATED','SHARED')", name="ck_charge_status"),
        ForeignKeyConstraint(
            ["borrower_id", "user_id"], ["loan_borrowers.id", "loan_borrowers.user_id"],
            name="fk_charge_borrower_owner", ondelete="RESTRICT",
        ),
        Index("ix_charges_user_borrower", "user_id", "borrower_id"),
    )


class LoanChargeItem(Base):
    __tablename__ = "loan_charge_items"
    id = Column(Integer, primary_key=True)
    charge_id = Column(Integer, ForeignKey("loan_charges.id", ondelete="RESTRICT"), nullable=False)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=False)
    installment_id = Column(Integer, ForeignKey("loan_installments.id", ondelete="RESTRICT"), nullable=False)
    installment_number = Column(Integer, nullable=False)
    due_on = Column(Date, nullable=False)
    amount_cents = Column(BigInteger, nullable=False)
    __table_args__ = (CheckConstraint("amount_cents > 0", name="ck_charge_item_pos"),)


class LoanEvent(Base):
    __tablename__ = "loan_events"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=True)
    receipt_id = Column(Integer, ForeignKey("loan_receipts.id", ondelete="RESTRICT"), nullable=True)
    type = Column(String(40), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = _ts()
    __table_args__ = (Index("ix_events_loan", "loan_id"),)


class LoanIdempotencyKey(Base):
    __tablename__ = "loan_idempotency_keys"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scope = Column(String(30), nullable=False)
    key = Column(String(80), nullable=False)
    fingerprint = Column(String(64), nullable=False)
    resource_id = Column(Integer, nullable=True)
    created_at = _ts()
    __table_args__ = (UniqueConstraint("user_id", "scope", "key", name="uq_idempotency"),)
