"""SPEC003 — relatórios. Fonte: cronograma vigente (is_active) e alocações de
recibos NÃO estornados. Previsto por `due_on`; realizado por `received_on`;
desembolso por `funded_on`. Recebimento bruto ≠ lucro: juros/ajustes separados."""
import re
from calendar import monthrange
from datetime import date

from sqlalchemy import func

from loans.errors import invalid
from loans.money import cents_to_str
from loans.serializers import installment_out, loan_out
from models.loans import Loan, LoanAdjustment, LoanCharge, LoanInstallment, LoanReceipt, LoanReceiptAllocation

LIVE = ("ACTIVE", "SETTLED")


def _open_components(rows):
    p = sum(i.principal_cents - i.paid_principal_cents for i in rows)
    j = sum(i.interest_cents - i.paid_interest_cents for i in rows)
    a = sum(i.adjustment_cents - i.paid_adjustment_cents for i in rows)
    return p, j, a


def portfolio(db, user_id, today):
    rows = (db.query(LoanInstallment, Loan).join(Loan, Loan.id == LoanInstallment.loan_id)
            .filter(Loan.user_id == user_id, Loan.status == "ACTIVE", LoanInstallment.is_active.is_(True)).all())
    insts = [i for i, _ in rows]
    p, j, a = _open_components(insts)
    overdue = [i for i in insts if i.remaining_cents > 0 and today > i.due_on]
    upcoming = sorted([i for i in insts if i.remaining_cents > 0 and i.due_on >= today], key=lambda i: (i.due_on, i.id))[:10]
    counts = dict(db.query(Loan.status, func.count()).filter(Loan.user_id == user_id).group_by(Loan.status).all())
    return {
        "today": today.isoformat(),
        "principal_outstanding": cents_to_str(p), "interest_future": cents_to_str(j), "adjustments_open": cents_to_str(a),
        "total_receivable": cents_to_str(p + j + a),
        "overdue_count": len(overdue), "overdue_amount": cents_to_str(sum(i.remaining_cents for i in overdue)),
        "upcoming": [installment_out(i, today) for i in upcoming],
        "loans_by_status": {k: counts.get(k, 0) for k in ("DRAFT", "ACTIVE", "SETTLED", "CANCELLED")},
    }


def _month_bounds(month: str):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month or ""):
        raise invalid("month deve ser YYYY-MM")
    y, m = map(int, month.split("-"))
    return date(y, m, 1), date(y, m, monthrange(y, m)[1])


def monthly(db, user_id, month, today):
    start, end = _month_bounds(month)
    disbursed = (db.query(func.coalesce(func.sum(Loan.principal_cents), 0))
                 .filter(Loan.user_id == user_id, Loan.status.in_(LIVE), Loan.funded_on.between(start, end)).scalar())
    rec = (db.query(func.coalesce(func.sum(LoanReceiptAllocation.principal_cents), 0),
                    func.coalesce(func.sum(LoanReceiptAllocation.interest_cents), 0),
                    func.coalesce(func.sum(LoanReceiptAllocation.adjustment_cents), 0))
           .join(LoanReceipt, LoanReceipt.id == LoanReceiptAllocation.receipt_id)
           .filter(LoanReceipt.user_id == user_id, LoanReceipt.reversed_at.is_(None),
                   LoanReceipt.received_on.between(start, end)).one())
    n_receipts = (db.query(func.count(LoanReceipt.id)).filter(LoanReceipt.user_id == user_id, LoanReceipt.reversed_at.is_(None),
                                                               LoanReceipt.received_on.between(start, end)).scalar())
    rp, ri, ra = (int(x) for x in rec)
    received = rp + ri + ra
    due = (db.query(LoanInstallment, Loan).join(Loan, Loan.id == LoanInstallment.loan_id)
           .filter(Loan.user_id == user_id, Loan.status.in_(LIVE), LoanInstallment.is_active.is_(True),
                   LoanInstallment.due_on.between(start, end))
           .order_by(LoanInstallment.due_on, Loan.id, LoanInstallment.number).all())
    insts = [i for i, _ in due]
    open_ = [i for i in insts if i.remaining_cents > 0]
    return {
        "month": month,
        "realized": {
            "disbursed": cents_to_str(int(disbursed)), "received_total": cents_to_str(received),
            "principal_recovered": cents_to_str(rp), "interest_received": cents_to_str(ri), "adjustments_received": cents_to_str(ra),
            "net_cashflow": cents_to_str(received - int(disbursed)), "receipts_count": int(n_receipts),
        },
        "expected": {
            "scheduled_total": cents_to_str(sum(i.total_cents for i in insts)),
            "scheduled_principal": cents_to_str(sum(i.principal_cents for i in insts)),
            "scheduled_interest": cents_to_str(sum(i.interest_cents for i in insts)),
            "already_paid": cents_to_str(sum(i.paid_cents for i in insts)),
            "open_total": cents_to_str(sum(i.remaining_cents for i in open_)),
            "overdue_open": cents_to_str(sum(i.remaining_cents for i in open_ if today > i.due_on)),
            "upcoming_open": cents_to_str(sum(i.remaining_cents for i in open_ if today <= i.due_on)),
            "installments": [{**installment_out(i, today), "borrower_id": l.borrower_id} for i, l in due],
        },
    }


def statement(db, user_id, borrower, today):
    loans = db.query(Loan).filter(Loan.user_id == user_id, Loan.borrower_id == borrower.id).order_by(Loan.id).all()
    out_loans, open_insts = [], []
    for l in loans:
        insts = db.query(LoanInstallment).filter(LoanInstallment.loan_id == l.id).all()
        out_loans.append(loan_out(l, insts, today, borrower_name=borrower.name))
        if l.status == "ACTIVE":
            open_insts += [i for i in insts if i.is_active and i.remaining_cents > 0]
    receipts = (db.query(LoanReceipt).filter(LoanReceipt.user_id == user_id, LoanReceipt.borrower_id == borrower.id)
                .order_by(LoanReceipt.received_on.desc(), LoanReceipt.id.desc()).all())
    charges = (db.query(LoanCharge).filter(LoanCharge.user_id == user_id, LoanCharge.borrower_id == borrower.id)
               .order_by(LoanCharge.id.desc()).all())
    adjustments = (db.query(LoanAdjustment, LoanInstallment)
                   .join(LoanInstallment, LoanAdjustment.installment_id == LoanInstallment.id)
                   .join(Loan, Loan.id == LoanAdjustment.loan_id)
                   .filter(LoanAdjustment.user_id == user_id, Loan.user_id == user_id,
                           Loan.borrower_id == borrower.id)
                   .order_by(LoanAdjustment.id.desc()).all())
    adjustment_history = []
    for adj, inst in adjustments:
        already_reversed = adj.reversed_at is not None
        received = inst.paid_adjustment_cents > inst.adjustment_cents - adj.amount_cents
        blocked = ('Acréscimo já estornado.' if already_reversed else
                   'Acréscimo já recebido; estorne o recebimento antes.' if received else None)
        adjustment_history.append({
            'id': adj.id, 'loan_id': adj.loan_id, 'installment_id': inst.id,
            'installment_number': inst.number, 'amount': cents_to_str(adj.amount_cents),
            'reason': adj.reason, 'reversed': already_reversed,
            'can_reverse': blocked is None, 'blocked_reason': blocked,
        })
    return {
        "borrower": {"id": borrower.id, "name": borrower.name, "contact": borrower.contact, "archived": borrower.archived_at is not None},
        "loans": out_loans,
        "adjustments": adjustment_history,
        "open_total": cents_to_str(sum(i.remaining_cents for i in open_insts)),
        "overdue_total": cents_to_str(sum(i.remaining_cents for i in open_insts if today > i.due_on)),
        "receipts": [{"id": r.id, "received_on": r.received_on.isoformat(), "amount": cents_to_str(r.amount_cents),
                      "kind": r.kind, "reversed": r.reversed_at is not None} for r in receipts],
        "charges": [{"id": c.id, "total": cents_to_str(c.total_cents), "status": c.status, "created_at": c.created_at.isoformat()}
                    for c in charges],
    }
