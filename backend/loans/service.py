"""SPEC003 — comandos transacionais do módulo Empréstimos.

Regras:
- owner sempre `user.id` (JWT); toda busca usa filtro composto id+user_id → 404.
- Cada comando é UMA transação; qualquer erro → rollback total (sessão fechada sem commit).
- Concorrência: `SELECT ... FOR UPDATE` em loan/installments (ordem por id) + chave de
  idempotência única (user, scope, key) inserida no início da transação.
- Replay idêntico → mesmo recurso (200). Mesma chave com payload distinto → 409.
"""
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from loans import schedule as sch
from loans.errors import conflict, invalid, not_found
from loans.money import MoneyError, cents_to_str, parse_money_to_cents, parse_rate, rate_to_str
from loans.pix import PixError, build_brcode
from loans.serializers import installment_out, loan_out
from models.loans import (
    Loan, LoanAdjustment, LoanBorrower, LoanCharge, LoanChargeItem, LoanEvent, LoanIdempotencyKey,
    LoanInstallment, LoanPixAccount, LoanReceipt, LoanReceiptAllocation, LoanScheduleVersion,
)

RATE_UNIT = {"fixed_addon": "per_installment_on_principal", "price": "monthly_effective"}


def _now():
    return datetime.now(timezone.utc)


def _fingerprint(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _event(db, user_id, type_, loan_id=None, receipt_id=None, **payload):
    db.add(LoanEvent(user_id=user_id, loan_id=loan_id, receipt_id=receipt_id, type=type_, payload=payload))


class _Replay(Exception):
    def __init__(self, resource_id):
        self.resource_id = resource_id


def _claim_key(db: Session, user_id: int, scope: str, key: str, fingerprint: str) -> LoanIdempotencyKey:
    """Reserva a chave dentro da transação atual. Concorrente com mesma chave espera o
    commit do primeiro (índice único) e então recebe replay/409."""
    existing = db.query(LoanIdempotencyKey).filter_by(user_id=user_id, scope=scope, key=key).first()
    if existing is None:
        row = LoanIdempotencyKey(user_id=user_id, scope=scope, key=key, fingerprint=fingerprint)
        try:
            with db.begin_nested():
                db.add(row)
                db.flush()
            return row
        except IntegrityError:
            existing = db.query(LoanIdempotencyKey).filter_by(user_id=user_id, scope=scope, key=key).first()
    if existing.fingerprint != fingerprint:
        raise conflict("Chave de idempotência já usada com outro conteúdo.")
    raise _Replay(existing.resource_id)


# ------------------------------------------------------------------ termos / simulação
def _build(terms) -> dict:
    try:
        principal = parse_money_to_cents(terms.principal)
        rate = parse_rate(terms.rate)
    except (MoneyError, TypeError) as e:
        raise invalid(str(e))
    try:
        dates = sch.due_dates(terms.frequency, terms.installment_count, terms.first_due_on,
                              interval_days=terms.interval_days, manual_dates=terms.manual_dates)
        if dates[0] <= terms.start_on:
            raise sch.ScheduleError("primeiro vencimento deve ser posterior à data de início")
        if terms.interest_method == "fixed_addon":
            rows = sch.fixed_addon_schedule(principal, rate, dates)
        else:
            rows = sch.price_schedule(principal, rate, dates, start_on=terms.start_on, frequency=terms.frequency)
    except sch.ScheduleError as e:
        raise invalid(str(e))
    canon = {
        "principal_cents": principal, "interest_method": terms.interest_method, "rate": rate_to_str(rate),
        "installment_count": terms.installment_count, "frequency": terms.frequency,
        "interval_days": terms.interval_days if terms.frequency == "every_x_days" else None,
        "start_on": terms.start_on.isoformat(), "dates": [d.isoformat() for d in dates],
    }
    return {"principal": principal, "rate": rate, "dates": dates, "rows": rows, "hash": _fingerprint(canon)}


def _rows_out(rows):
    return [{"number": r.number, "due_on": r.due_on.isoformat(), "principal": cents_to_str(r.principal),
             "interest": cents_to_str(r.interest), "total": cents_to_str(r.total)} for r in rows]


def _totals(rows):
    p, i = sum(r.principal for r in rows), sum(r.interest for r in rows)
    return {"principal": cents_to_str(p), "interest": cents_to_str(i), "total": cents_to_str(p + i)}


def _price_warnings(rows):
    """Aviso UX não bloqueante para desvio relevante no ajuste final Price.

    O valor-base é a primeira prestação. Somente alerta se o desvio for
    simultaneamente >= R$ 1,00 E >= 1% da prestação-base; não muda
    o cronograma, a taxa, os centavos nem representa regra de produto aprovada.
    """
    if len(rows) < 2:
        return []
    first, last = rows[0].total, rows[-1].total
    diff = last - first
    if abs(diff) < max(100, (first + 99) // 100):
        return []
    return [{
        "code": "PRICE_LAST_INSTALLMENT_DISTORTION",
        "first_installment": cents_to_str(first),
        "last_installment": cents_to_str(last),
        "difference": cents_to_str(diff),
        "message": "O arredondamento acumulado gera uma última prestação diferente das anteriores. "
                   "Confira o cronograma antes de salvar.",
    }]


def simulate(terms):
    b = _build(terms)
    return {
        "interest_method": terms.interest_method, "rate": rate_to_str(b["rate"]), "rate_unit": RATE_UNIT[terms.interest_method],
        "installments": _rows_out(b["rows"]), "totals": _totals(b["rows"]), "terms_hash": b["hash"], "persisted": False,
        "warnings": _price_warnings(b["rows"]) if terms.interest_method == "price" else [],
    }


# ------------------------------------------------------------------ consultas
def _owned_loan(db, user, loan_id, lock=False) -> Loan:
    q = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user.id)
    if lock:
        q = q.with_for_update().populate_existing()
    loan = q.first()
    if loan is None:
        raise not_found("Empréstimo")
    return loan


def _installments(db, loan_id, lock=False):
    q = db.query(LoanInstallment).filter(LoanInstallment.loan_id == loan_id).order_by(LoanInstallment.id)
    if lock:
        q = q.with_for_update().populate_existing()
    return q.all()


def _detail(db, loan, today):
    b = db.get(LoanBorrower, loan.borrower_id)
    return loan_out(loan, _installments(db, loan.id), today, borrower_name=b.name if b else None)


def contract_detail(db, user, loan_id, today):
    return _detail(db, _owned_loan(db, user, loan_id), today)


def list_contracts(db, user, today, borrower_id=None, status=None):
    q = db.query(Loan).filter(Loan.user_id == user.id)
    if borrower_id is not None:
        q = q.filter(Loan.borrower_id == borrower_id)
    if status:
        q = q.filter(Loan.status == status)
    return [_detail(db, l, today) for l in q.order_by(Loan.id.desc())]


# ------------------------------------------------------------------ criação / funding / cancelamento
def create_contract(db: Session, user, payload, today):
    borrower = db.query(LoanBorrower).filter(LoanBorrower.id == payload.borrower_id, LoanBorrower.user_id == user.id).first()
    if borrower is None:
        raise not_found("Tomador")
    if borrower.archived_at is not None:
        raise conflict("Tomador arquivado.")
    b = _build(payload)
    if payload.terms_hash and payload.terms_hash != b["hash"]:
        raise conflict("Termos mudaram desde a simulação; simule novamente.")
    fp = _fingerprint({**payload.model_dump(mode="json", exclude={"idempotency_key", "terms_hash"})})
    try:
        key = _claim_key(db, user.id, "contract", payload.idempotency_key, fp)
    except _Replay as r:
        db.rollback()
        return contract_detail(db, user, r.resource_id, today), False
    loan = Loan(
        user_id=user.id, borrower_id=borrower.id, description=payload.description, principal_cents=b["principal"],
        interest_method=payload.interest_method, rate=b["rate"], rate_unit=RATE_UNIT[payload.interest_method],
        installment_count=payload.installment_count, frequency=payload.frequency,
        interval_days=payload.interval_days if payload.frequency == "every_x_days" else None,
        start_on=payload.start_on, first_due_on=b["dates"][0], terms_hash=b["hash"], status="DRAFT", current_version=1,
    )
    db.add(loan)
    db.flush()
    db.add(LoanScheduleVersion(loan_id=loan.id, number=1, reason="initial", actor_user_id=user.id))
    for r in b["rows"]:
        db.add(LoanInstallment(loan_id=loan.id, version=1, number=r.number, due_on=r.due_on,
                               principal_cents=r.principal, interest_cents=r.interest))
    key.resource_id = loan.id
    _event(db, user.id, "contract_created", loan_id=loan.id, terms_hash=b["hash"])
    db.commit()
    return contract_detail(db, user, loan.id, today), True


def fund_contract(db: Session, user, loan_id, payload, today):
    loan = _owned_loan(db, user, loan_id, lock=True)
    fp = _fingerprint({"loan_id": loan_id, **payload.model_dump(mode="json", exclude={"idempotency_key"})})
    try:
        key = _claim_key(db, user.id, "fund", payload.idempotency_key, fp)
    except _Replay:
        db.rollback()
        return contract_detail(db, user, loan_id, today)
    if loan.status != "DRAFT":
        raise conflict("Somente empréstimo em rascunho pode ser ativado.")
    if payload.funded_on >= loan.first_due_on:
        raise invalid("Data do envio deve ser anterior ao primeiro vencimento.")
    if payload.funded_on > today:
        raise invalid("Data do envio não pode estar no futuro.")
    loan.status, loan.funded_on, loan.funding_method = "ACTIVE", payload.funded_on, payload.method
    loan.funding_source, loan.funding_note = payload.source, payload.note
    key.resource_id = loan.id
    _event(db, user.id, "contract_funded", loan_id=loan.id, funded_on=payload.funded_on.isoformat(), method=payload.method)
    db.commit()
    return contract_detail(db, user, loan_id, today)


def cancel_contract(db: Session, user, loan_id, today):
    loan = _owned_loan(db, user, loan_id, lock=True)
    if loan.status != "DRAFT":
        raise conflict("Somente rascunho sem envio pode ser cancelado.")
    loan.status = "CANCELLED"
    _event(db, user.id, "contract_cancelled", loan_id=loan.id)
    db.commit()
    return contract_detail(db, user, loan_id, today)


# ------------------------------------------------------------------ status
def _refresh_installment_status(i: LoanInstallment):
    if i.remaining_cents == 0:
        i.status = "PAID"
    elif i.paid_cents > 0:
        i.status = "PARTIALLY_PAID"
    else:
        i.status = "PENDING"


def _refresh_loan_status(db, loan: Loan):
    if loan.status not in ("ACTIVE", "SETTLED"):
        return
    db.flush()
    active = [i for i in _installments(db, loan.id) if i.is_active]
    loan.status = "SETTLED" if all(i.status == "PAID" for i in active) else "ACTIVE"


# ------------------------------------------------------------------ recebimentos
def _apply_allocation(db, receipt, inst: LoanInstallment, parts: tuple[int, int, int], kind: str):
    p, i, a = parts
    inst.paid_principal_cents += p
    inst.paid_interest_cents += i
    inst.paid_adjustment_cents += a
    _refresh_installment_status(inst)
    alloc = LoanReceiptAllocation(receipt_id=receipt.id, loan_id=inst.loan_id, installment_id=inst.id,
                                  installment_version=inst.version, kind=kind,
                                  principal_cents=p, interest_cents=i, adjustment_cents=a)
    db.add(alloc)
    return alloc


def _owned_pix_id(db, user, pix_id):
    if pix_id is None:
        return None
    p = db.query(LoanPixAccount).filter(LoanPixAccount.id == pix_id, LoanPixAccount.user_id == user.id).first()
    if p is None:
        raise not_found("Conta Pix")
    return p.id


def create_receipt(db: Session, user, payload, today):
    borrower = db.query(LoanBorrower).filter(LoanBorrower.id == payload.borrower_id, LoanBorrower.user_id == user.id).first()
    if borrower is None:
        raise not_found("Tomador")
    pix_id = _owned_pix_id(db, user, payload.pix_account_id)
    try:
        amount = parse_money_to_cents(payload.amount)
    except MoneyError as e:
        raise invalid(str(e))
    if payload.received_on > today:
        raise invalid("Data de recebimento não pode estar no futuro.")
    fp = _fingerprint(payload.model_dump(mode="json", exclude={"idempotency_key"}))
    try:
        key = _claim_key(db, user.id, "receipt", payload.idempotency_key, fp)
    except _Replay as r:
        db.rollback()
        return receipt_detail(db, user, r.resource_id), False

    if payload.kind == "price_amortization":
        receipt = _price_amortization(db, user, borrower, payload, amount, pix_id)
    else:
        receipt = _installment_receipt(db, user, borrower, payload, amount, pix_id)
    key.resource_id = receipt.id
    db.commit()
    return receipt_detail(db, user, receipt.id), True


def _installment_receipt(db, user, borrower, payload, amount, pix_id):
    if payload.loan_id is not None or payload.strategy is not None:
        raise invalid("loan_id/strategy só se aplicam a amortização Price.")
    ids = [it.installment_id for it in payload.items]
    if not ids:
        raise invalid("Selecione ao menos uma parcela.")
    if len(set(ids)) != len(ids):
        raise invalid("Parcela repetida no recebimento.")
    if payload.kind == "full" and any(it.amount is not None for it in payload.items):
        raise invalid("Recebimento integral não aceita valor por parcela; use parcial explicitamente.")
    if payload.kind == "partial" and any(it.amount is None for it in payload.items):
        raise invalid("Pagamento parcial exige valor explícito por parcela.")

    # lock: loans (ordem id) depois parcelas (ordem id) → ordem global consistente
    rows = (db.query(LoanInstallment, Loan).join(Loan, Loan.id == LoanInstallment.loan_id)
            .filter(LoanInstallment.id.in_(ids), Loan.user_id == user.id).all())
    if len(rows) != len(ids):
        raise not_found("Parcela")
    loan_ids = sorted({loan.id for _, loan in rows})
    loans = {l.id: l for l in db.query(Loan).filter(Loan.id.in_(loan_ids), Loan.user_id == user.id)
             .order_by(Loan.id).with_for_update().populate_existing().all()}
    insts = {i.id: i for i in db.query(LoanInstallment).filter(LoanInstallment.id.in_(ids))
             .order_by(LoanInstallment.id).with_for_update().populate_existing().all()}
    for lid, loan in loans.items():
        if loan.borrower_id != borrower.id:
            raise invalid("Todas as parcelas devem ser do mesmo tomador.")
        if loan.status != "ACTIVE":
            raise conflict("Empréstimo não está ativo para recebimento.")
        if payload.received_on < loan.funded_on:
            raise invalid("Recebimento anterior ao envio do empréstimo.")

    plan = []
    for it in payload.items:
        inst = insts[it.installment_id]
        if not inst.is_active:
            raise conflict("Parcela pertence a cronograma substituído.")
        rem = [inst.principal_cents - inst.paid_principal_cents, inst.interest_cents - inst.paid_interest_cents,
               inst.adjustment_cents - inst.paid_adjustment_cents]
        if sum(rem) == 0:
            raise conflict("Parcela já quitada.")
        if payload.kind == "full":
            parts = rem
        else:
            try:
                val = parse_money_to_cents(it.amount)
                parts = sch.allocate_proportional(val, rem)
            except (MoneyError, sch.ScheduleError) as e:
                raise invalid(str(e))
        plan.append((inst, tuple(parts)))
    total = sum(sum(p) for _, p in plan)
    if total != amount:
        raise conflict(f"Valor informado difere do total selecionado ({cents_to_str(total)}).")

    receipt = LoanReceipt(user_id=user.id, borrower_id=borrower.id, received_on=payload.received_on, amount_cents=amount,
                          kind=payload.kind, method=payload.method, pix_account_id=pix_id, note=payload.note)
    db.add(receipt)
    db.flush()
    for inst, parts in plan:
        kind = "anticipation" if payload.received_on < inst.due_on else "installment"
        _apply_allocation(db, receipt, inst, parts, kind)
    for loan in loans.values():
        _refresh_loan_status(db, loan)
    _event(db, user.id, "receipt_created", receipt_id=receipt.id, kind=payload.kind, amount_cents=amount,
           installments=sorted(ids))
    return receipt


# ------------------------------------------------------------------ Price: amortização extraordinária
def _amortization_plan(db, loan, amount, strategy, on, lock):
    if loan.interest_method != "price":
        raise invalid("Amortização com recálculo só existe no modelo Price; no adicional fixo, antecipe parcelas.")
    if loan.status != "ACTIVE":
        raise conflict("Empréstimo não está ativo.")
    if on < loan.funded_on:
        raise invalid("Data anterior ao envio do empréstimo.")
    active = [i for i in _installments(db, loan.id, lock=lock) if i.is_active]
    future = sorted([i for i in active if i.due_on > on], key=lambda i: i.due_on)
    kept = [i for i in active if i.due_on <= on]
    if not future:
        raise conflict("Não há parcelas futuras para amortizar.")
    if any(i.paid_cents > 0 or i.adjustment_cents > 0 for i in future):
        raise conflict("Há parcela futura com pagamento parcial ou ajuste; regularize antes de amortizar.")
    balance = sum(i.principal_cents for i in future)
    if amount <= 0 or amount > balance:
        raise invalid(f"Amortização deve ser > 0 e ≤ saldo futuro ({cents_to_str(balance)}).")
    base = max([i.due_on for i in kept], default=loan.start_on)
    current_installment = future[0].principal_cents + future[0].interest_cents
    try:
        rows = sch.price_reamortize(balance - amount, loan.rate, [i.due_on for i in future], base_date=base,
                                    frequency=loan.frequency, strategy=strategy,
                                    current_installment_cents=current_installment)
    except sch.ScheduleError as e:
        raise invalid(str(e))
    return future, kept, balance, rows


def prepayment_preview(db, user, loan_id, payload):
    loan = _owned_loan(db, user, loan_id)
    try:
        amount = parse_money_to_cents(payload.amount)
    except MoneyError as e:
        raise invalid(str(e))
    future, kept, balance, rows = _amortization_plan(db, loan, amount, payload.strategy, payload.on, lock=False)
    db.rollback()
    return {"loan_id": loan.id, "strategy": payload.strategy, "amortization": cents_to_str(amount),
            "balance_before": cents_to_str(balance), "balance_after": cents_to_str(balance - amount),
            "installments": _rows_out(rows), "totals": _totals(rows), "persisted": False,
            "warnings": _price_warnings(rows) if payload.strategy == "reduce_installment" else []}


def _price_amortization(db, user, borrower, payload, amount, pix_id):
    if payload.items:
        raise invalid("Amortização não usa seleção de parcelas.")
    if payload.loan_id is None or payload.strategy is None:
        raise invalid("Informe loan_id e strategy.")
    loan = _owned_loan(db, user, payload.loan_id, lock=True)
    if loan.borrower_id != borrower.id:
        raise invalid("Empréstimo não pertence ao tomador informado.")
    future, kept, balance, rows = _amortization_plan(db, loan, amount, payload.strategy, payload.received_on, lock=True)
    receipt = LoanReceipt(user_id=user.id, borrower_id=borrower.id, received_on=payload.received_on, amount_cents=amount,
                          kind="price_amortization", method=payload.method, pix_account_id=pix_id, note=payload.note)
    db.add(receipt)
    db.flush()
    db.add(LoanReceiptAllocation(receipt_id=receipt.id, loan_id=loan.id, installment_id=None, installment_version=None,
                                 kind="amortization", principal_cents=amount, interest_cents=0, adjustment_cents=0))
    new_v = loan.current_version + 1
    for i in future:
        i.is_active, i.superseded_in_version = False, new_v
    start_number = max([i.number for i in kept], default=0)
    for r in rows:
        db.add(LoanInstallment(loan_id=loan.id, version=new_v, number=start_number + r.number, due_on=r.due_on,
                               principal_cents=r.principal, interest_cents=r.interest))
    db.add(LoanScheduleVersion(loan_id=loan.id, number=new_v, reason=f"amortization_{payload.strategy}",
                               actor_user_id=user.id, receipt_id=receipt.id))
    loan.current_version = new_v
    _refresh_loan_status(db, loan)
    _event(db, user.id, "schedule_recalculated", loan_id=loan.id, receipt_id=receipt.id, version=new_v,
           strategy=payload.strategy, amortization_cents=amount, balance_before_cents=balance)
    return receipt


# ------------------------------------------------------------------ estorno
def _owned_receipt(db, user, receipt_id, lock=False) -> LoanReceipt:
    q = db.query(LoanReceipt).filter(LoanReceipt.id == receipt_id, LoanReceipt.user_id == user.id)
    if lock:
        q = q.with_for_update().populate_existing()
    r = q.first()
    if r is None:
        raise not_found("Recebimento")
    return r


def reverse_receipt(db: Session, user, receipt_id, payload):
    receipt = _owned_receipt(db, user, receipt_id, lock=True)
    if receipt.reversed_at is not None:
        raise conflict("Recebimento já estornado.")
    allocs = db.query(LoanReceiptAllocation).filter_by(receipt_id=receipt.id).order_by(LoanReceiptAllocation.id).all()
    loan_ids = sorted({a.loan_id for a in allocs})
    loans = {l.id: l for l in db.query(Loan).filter(Loan.id.in_(loan_ids), Loan.user_id == user.id)
             .order_by(Loan.id).with_for_update().populate_existing().all()}
    if receipt.kind == "price_amortization":
        _reverse_amortization(db, user, receipt, loans[allocs[0].loan_id])
    else:
        inst_ids = sorted(a.installment_id for a in allocs)
        insts = {i.id: i for i in db.query(LoanInstallment).filter(LoanInstallment.id.in_(inst_ids))
                 .order_by(LoanInstallment.id).with_for_update().populate_existing().all()}
        for a in allocs:
            i = insts[a.installment_id]
            i.paid_principal_cents -= a.principal_cents
            i.paid_interest_cents -= a.interest_cents
            i.paid_adjustment_cents -= a.adjustment_cents
            _refresh_installment_status(i)
    receipt.reversed_at, receipt.reversal_reason = _now(), payload.reason
    for loan in loans.values():
        _refresh_loan_status(db, loan)
    _event(db, user.id, "receipt_reversed", receipt_id=receipt.id, reason=payload.reason)
    db.commit()
    return receipt_detail(db, user, receipt.id)


def _reverse_amortization(db, user, receipt, loan):
    sv = db.query(LoanScheduleVersion).filter_by(loan_id=loan.id, receipt_id=receipt.id).first()
    if sv is None or sv.number != loan.current_version:
        raise conflict("Estorne primeiro as amortizações posteriores deste empréstimo.")
    insts = _installments(db, loan.id, lock=True)
    created = [i for i in insts if i.version == sv.number and i.is_active]
    if any(i.paid_cents > 0 or i.adjustment_cents > 0 for i in created):
        raise conflict("Cronograma recalculado já tem pagamentos/ajustes; estorne-os antes.")
    new_v = loan.current_version + 1
    for i in created:
        i.is_active, i.superseded_in_version = False, new_v
    db.flush()
    for i in insts:
        if i.superseded_in_version == sv.number and i.version != sv.number:
            i.is_active, i.superseded_in_version = True, None
    db.add(LoanScheduleVersion(loan_id=loan.id, number=new_v, reason="amortization_reversal",
                               actor_user_id=user.id, receipt_id=receipt.id))
    loan.current_version = new_v
    _event(db, user.id, "schedule_restored", loan_id=loan.id, receipt_id=receipt.id, version=new_v, restored_from=sv.number - 1)


def _receipt_out(db, r):
    allocs = db.query(LoanReceiptAllocation).filter_by(receipt_id=r.id).order_by(LoanReceiptAllocation.id).all()
    inst_map = {}
    ids = [a.installment_id for a in allocs if a.installment_id]
    if ids:
        inst_map = {i.id: i for i in db.query(LoanInstallment).filter(LoanInstallment.id.in_(ids))}
    return {
        "id": r.id, "borrower_id": r.borrower_id, "received_on": r.received_on.isoformat(), "amount": cents_to_str(r.amount_cents),
        "kind": r.kind, "method": r.method, "pix_account_id": r.pix_account_id, "note": r.note,
        "reversed": r.reversed_at is not None, "reversal_reason": r.reversal_reason,
        "allocations": [{
            "loan_id": a.loan_id, "installment_id": a.installment_id, "kind": a.kind,
            "installment_number": inst_map[a.installment_id].number if a.installment_id else None,
            "due_on": inst_map[a.installment_id].due_on.isoformat() if a.installment_id else None,
            "principal": cents_to_str(a.principal_cents), "interest": cents_to_str(a.interest_cents),
            "adjustment": cents_to_str(a.adjustment_cents),
        } for a in allocs],
    }


def receipt_detail(db, user, receipt_id):
    return _receipt_out(db, _owned_receipt(db, user, receipt_id))


def list_receipts(db, user, borrower_id=None):
    q = db.query(LoanReceipt).filter(LoanReceipt.user_id == user.id)
    if borrower_id is not None:
        q = q.filter(LoanReceipt.borrower_id == borrower_id)
    return [_receipt_out(db, r) for r in q.order_by(LoanReceipt.received_on.desc(), LoanReceipt.id.desc())]


# ------------------------------------------------------------------ ajustes manuais
def _owned_installment(db, user, installment_id, lock=False):
    row = (db.query(LoanInstallment, Loan).join(Loan, Loan.id == LoanInstallment.loan_id)
           .filter(LoanInstallment.id == installment_id, Loan.user_id == user.id).first())
    if row is None:
        raise not_found("Parcela")
    if lock:
        loan = db.query(Loan).filter(Loan.id == row[1].id).with_for_update().populate_existing().one()
        inst = db.query(LoanInstallment).filter(LoanInstallment.id == installment_id).with_for_update().populate_existing().one()
        return inst, loan
    return row


def _adj_out(adj, inst):
    return {"id": adj.id, "installment_id": adj.installment_id, "amount": cents_to_str(adj.amount_cents), "reason": adj.reason,
            "reversed": adj.reversed_at is not None, "installment": installment_out(inst)}


def create_adjustment(db: Session, user, installment_id, payload):
    inst, loan = _owned_installment(db, user, installment_id, lock=True)
    try:
        amount = parse_money_to_cents(payload.amount)
    except MoneyError as e:
        raise invalid(str(e))
    fp = _fingerprint({"installment_id": installment_id, **payload.model_dump(mode="json", exclude={"idempotency_key"})})
    try:
        key = _claim_key(db, user.id, "adjustment", payload.idempotency_key, fp)
    except _Replay as r:
        db.rollback()
        adj = db.get(LoanAdjustment, r.resource_id)
        return _adj_out(adj, db.get(LoanInstallment, adj.installment_id)), False
    if loan.status != "ACTIVE" or not inst.is_active:
        raise conflict("Parcela não aceita ajuste (empréstimo inativo ou cronograma substituído).")
    if inst.status == "PAID":
        raise conflict("Parcela já quitada.")
    adj = LoanAdjustment(user_id=user.id, loan_id=loan.id, installment_id=inst.id, amount_cents=amount, reason=payload.reason)
    db.add(adj)
    inst.adjustment_cents += amount
    _refresh_installment_status(inst)
    db.flush()
    key.resource_id = adj.id
    _event(db, user.id, "adjustment_created", loan_id=loan.id, installment_id=inst.id, amount_cents=amount, reason=payload.reason)
    db.commit()
    return _adj_out(adj, inst), True


def reverse_adjustment(db: Session, user, adjustment_id):
    adj = db.query(LoanAdjustment).filter(LoanAdjustment.id == adjustment_id, LoanAdjustment.user_id == user.id).with_for_update().populate_existing().first()
    if adj is None:
        raise not_found("Ajuste")
    if adj.reversed_at is not None:
        raise conflict("Ajuste já estornado.")
    inst, loan = _owned_installment(db, user, adj.installment_id, lock=True)
    if inst.paid_adjustment_cents > inst.adjustment_cents - adj.amount_cents:
        raise conflict("Ajuste já recebido; estorne o recebimento antes.")
    inst.adjustment_cents -= adj.amount_cents
    adj.reversed_at = _now()
    _refresh_installment_status(inst)
    _refresh_loan_status(db, loan)
    _event(db, user.id, "adjustment_reversed", loan_id=loan.id, installment_id=inst.id, adjustment_id=adj.id)
    db.commit()
    return _adj_out(adj, inst)


# ------------------------------------------------------------------ cobranças Pix
def _fmt_brl(cents):
    s = cents_to_str(cents)
    whole, frac = s.split(".")
    whole = f"{int(whole):,}".replace(",", ".")
    return f"R$ {whole},{frac}"


def create_charge(db: Session, user, payload):
    borrower = db.query(LoanBorrower).filter(LoanBorrower.id == payload.borrower_id, LoanBorrower.user_id == user.id).first()
    if borrower is None:
        raise not_found("Tomador")
    ids = payload.installment_ids
    if len(set(ids)) != len(ids):
        raise invalid("Parcela repetida na cobrança.")
    rows = (db.query(LoanInstallment, Loan).join(Loan, Loan.id == LoanInstallment.loan_id)
            .filter(LoanInstallment.id.in_(ids), Loan.user_id == user.id).all())
    if len(rows) != len(ids):
        raise not_found("Parcela")
    for inst, loan in rows:
        if loan.borrower_id != borrower.id:
            raise invalid("Todas as parcelas devem ser do mesmo tomador.")
        if loan.status != "ACTIVE" or not inst.is_active or inst.remaining_cents == 0:
            raise conflict("Parcela não está em aberto.")
    q = db.query(LoanPixAccount).filter(LoanPixAccount.user_id == user.id, LoanPixAccount.is_active.is_(True))
    pix = q.filter(LoanPixAccount.id == payload.pix_account_id).first() if payload.pix_account_id else q.filter(LoanPixAccount.is_default.is_(True)).first()
    if pix is None:
        if payload.pix_account_id:
            raise not_found("Conta Pix")
        raise conflict("Cadastre uma conta Pix padrão ativa.")
    rows.sort(key=lambda r: (r[0].due_on, r[1].id, r[0].number))
    total = sum(inst.remaining_cents for inst, _ in rows)
    charge = LoanCharge(user_id=user.id, borrower_id=borrower.id, pix_account_id=pix.id, pix_key_snapshot=pix.key,
                        holder_name_snapshot=pix.holder_name, city_snapshot=pix.city, total_cents=total,
                        brcode="", message="", status="GENERATED")
    db.add(charge)
    db.flush()
    try:
        charge.brcode = build_brcode(key=pix.key, holder_name=pix.holder_name, city=pix.city, amount_cents=total,
                                     txid=f"COBAL{charge.id}")
    except PixError as e:
        raise invalid(f"Dados Pix inválidos para QR estático: {e}")
    lines = [f"Olá, {borrower.name}! Segue o resumo das parcelas em aberto:"]
    for inst, loan in rows:
        db.add(LoanChargeItem(charge_id=charge.id, loan_id=loan.id, installment_id=inst.id, installment_number=inst.number,
                              due_on=inst.due_on, amount_cents=inst.remaining_cents))
        lines.append(f"• Empréstimo #{loan.id} — parcela {inst.number} — venc. {inst.due_on.strftime('%d/%m/%Y')} — {_fmt_brl(inst.remaining_cents)}")
    lines += [f"Total: {_fmt_brl(total)}", f"Pix ({pix.holder_name}): {pix.key}", "Pix Copia e Cola:", charge.brcode,
              "Após pagar, me avise para eu confirmar o recebimento."]
    charge.message = "\n".join(lines)
    _event(db, user.id, "charge_generated", charge_id=charge.id, borrower_id=borrower.id, total_cents=total, items=len(rows))
    db.commit()
    return charge_detail(db, user, charge.id)


def _owned_charge(db, user, charge_id):
    c = db.query(LoanCharge).filter(LoanCharge.id == charge_id, LoanCharge.user_id == user.id).first()
    if c is None:
        raise not_found("Cobrança")
    return c


def _charge_out(db, c):
    items = db.query(LoanChargeItem).filter_by(charge_id=c.id).order_by(LoanChargeItem.id).all()
    current = {i.id: i for i in db.query(LoanInstallment).filter(LoanInstallment.id.in_([x.installment_id for x in items]))}
    out_items, diverged = [], False
    for x in items:
        cur = current[x.installment_id]
        cur_rem = cur.remaining_cents if cur.is_active else 0
        diverged |= cur_rem != x.amount_cents
        out_items.append({"loan_id": x.loan_id, "installment_id": x.installment_id, "installment_number": x.installment_number,
                          "due_on": x.due_on.isoformat(), "amount": cents_to_str(x.amount_cents),
                          "current_remaining": cents_to_str(cur_rem)})
    return {"id": c.id, "borrower_id": c.borrower_id, "pix_account_id": c.pix_account_id, "holder_name": c.holder_name_snapshot,
            "city": c.city_snapshot, "pix_key": c.pix_key_snapshot, "total": cents_to_str(c.total_cents), "brcode": c.brcode,
            "message": c.message, "status": c.status, "created_at": c.created_at.isoformat(),
            "shared_at": c.shared_at.isoformat() if c.shared_at else None, "items": out_items,
            "values_may_have_changed": diverged, "is_payment_confirmation": False}


def charge_detail(db, user, charge_id):
    return _charge_out(db, _owned_charge(db, user, charge_id))


def list_charges(db, user, borrower_id=None):
    q = db.query(LoanCharge).filter(LoanCharge.user_id == user.id)
    if borrower_id is not None:
        q = q.filter(LoanCharge.borrower_id == borrower_id)
    return [_charge_out(db, c) for c in q.order_by(LoanCharge.id.desc())]


def mark_charge_shared(db, user, charge_id):
    c = _owned_charge(db, user, charge_id)
    if c.status != "SHARED":
        c.status, c.shared_at = "SHARED", _now()
        _event(db, user.id, "charge_shared", charge_id=c.id)
        db.commit()
    return _charge_out(db, c)
