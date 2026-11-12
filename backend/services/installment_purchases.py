"""SPEC001: distribuição determinística e persistência SQL numa única transação."""

import calendar
import hashlib
import json
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.financial_entry_batches import FinancialEntryBatch
from models.financial_entries import FinancialEntry
from models.participant import Participant
from schemas.financial_entries import FinancialEntryResponse
from schemas.installment_purchases import InstallmentPurchaseCreate, InstallmentPurchaseResponse


def allocate_installments(total_cents: int, count: int) -> list[int]:
    if not 1 <= count <= 36 or not count <= total_cents <= 9_999_999_999:
        raise ValueError("total ou quantidade fora dos limites")
    base, remainder = divmod(total_cents, count)
    return [base + (i < remainder) for i in range(count)]


def monthly_date(original: date, months: int) -> date:
    month_index = (original.year - 1) * 12 + original.month - 1 + months
    year, zero_based_month = divmod(month_index, 12)
    year += 1
    month = zero_based_month + 1
    return date(year, month, min(original.day, calendar.monthrange(year, month)[1]))


def request_fingerprint(data: InstallmentPurchaseCreate, user_id: int) -> str:
    intent = dict(
        user_id=user_id, participant_id=data.participant_id,
        amount_cents=data.amount_cents,
        transaction_date=data.transaction_date.isoformat(),
        description=data.description, source=data.source,
        installment_total=data.installment_total,
    )
    canonical = json.dumps(intent, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _snapshot_or_conflict(batch: FinancialEntryBatch, digest: str):
    if batch.request_hash != digest:
        raise HTTPException(status_code=409, detail="Idempotency-Key reutilizada com outra compra")
    return batch.response_snapshot


def _replayed(db: Session, user_id: int, key: str, digest: str):
    batch = db.query(FinancialEntryBatch).filter_by(user_id=user_id, idempotency_key=key).first()
    if batch is None:
        # Uma falha de integridade não esperada deve permanecer erro, não sucesso.
        raise RuntimeError("colisão de idempotência não encontrada após rollback")
    return _snapshot_or_conflict(batch, digest)


def register_purchase(db: Session, user_id: int, key: str, data: InstallmentPurchaseCreate):
    """Retorna (snapshot, HTTP status). UNIQUE no PostgreSQL resolve corridas."""
    digest = request_fingerprint(data, user_id)
    try:
        # O snapshot é imutável mesmo se o participante for excluído depois.
        # O filtro por usuário impede replay de chaves pertencentes a outro owner.
        existing = db.query(FinancialEntryBatch).filter_by(user_id=user_id, idempotency_key=key).first()
        if existing is not None:
            return _snapshot_or_conflict(existing, digest), 200

        if db.query(Participant).filter_by(id=data.participant_id, user_id=user_id).first() is None:
            raise HTTPException(status_code=404, detail="Participante não encontrado")

        batch = FinancialEntryBatch(user_id=user_id, idempotency_key=key, request_hash=digest)
        db.add(batch)
        db.flush()  # o índice UNIQUE serializa a concorrência por usuário/chave

        entries = []
        for index, cents in enumerate(allocate_installments(data.amount_cents, data.installment_total)):
            entry = FinancialEntry(
                user_id=user_id, participant_id=data.participant_id, batch_id=batch.id,
                amount=Decimal(cents).scaleb(-2),
                transaction_date=monthly_date(data.transaction_date, index),
                description=data.description, source=data.source, is_reviewed=False,
                installment_number=index + 1, installment_total=data.installment_total,
            )
            db.add(entry)
            db.flush()
            entries.append(FinancialEntryResponse.model_validate(entry))

        response = InstallmentPurchaseResponse(
            batch_id=batch.id, total_amount=Decimal(data.amount_cents).scaleb(-2),
            installment_total=data.installment_total, entries=entries,
        )
        batch.response_snapshot = response.model_dump(mode="json")
        db.flush()
        db.commit()
        return batch.response_snapshot, 201
    except IntegrityError as error:
        db.rollback()  # obrigatório antes de reconsultar após UNIQUE
        if getattr(getattr(error.orig, "diag", None), "constraint_name", None) != "uq_financial_entry_batches_user_key":
            raise
        return _replayed(db, user_id, key, digest), 200
    except Exception:
        db.rollback()
        raise
