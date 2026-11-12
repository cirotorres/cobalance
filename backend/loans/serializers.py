from loans.money import cents_to_str, rate_to_str
from loans.pix import mask_key


def borrower_out(b):
    return {
        "id": b.id, "name": b.name, "contact": b.contact, "note": b.note,
        "archived": b.archived_at is not None, "created_at": b.created_at.isoformat(),
    }


def pix_out(p):
    return {
        "id": p.id, "label": p.label, "institution": p.institution, "holder_name": p.holder_name,
        "city": p.city, "key_type": p.key_type, "key_masked": mask_key(p.key_type, p.key),
        "is_default": p.is_default, "is_active": p.is_active,
    }


def installment_out(i, today=None):
    remaining = i.remaining_cents
    return {
        "id": i.id, "loan_id": i.loan_id, "version": i.version, "number": i.number,
        "due_on": i.due_on.isoformat(),
        "principal": cents_to_str(i.principal_cents), "interest": cents_to_str(i.interest_cents),
        "adjustment": cents_to_str(i.adjustment_cents), "total": cents_to_str(i.total_cents),
        "paid": cents_to_str(i.paid_cents), "remaining": cents_to_str(remaining),
        "status": i.status, "is_active": i.is_active,
        "overdue": bool(today and remaining > 0 and today > i.due_on),
    }


def loan_out(l, installments=None, today=None, borrower_name=None):
    out = {
        "id": l.id, "borrower_id": l.borrower_id, "borrower_name": borrower_name, "description": l.description,
        "principal": cents_to_str(l.principal_cents), "interest_method": l.interest_method,
        "rate": rate_to_str(l.rate), "rate_unit": l.rate_unit, "installment_count": l.installment_count,
        "frequency": l.frequency, "interval_days": l.interval_days,
        "start_on": l.start_on.isoformat(), "first_due_on": l.first_due_on.isoformat(),
        "status": l.status, "funded_on": l.funded_on.isoformat() if l.funded_on else None,
        "funding_method": l.funding_method, "current_version": l.current_version, "terms_hash": l.terms_hash,
    }
    if installments is not None:
        act = [i for i in installments if i.is_active]
        out["installments"] = [installment_out(i, today) for i in sorted(act, key=lambda x: (x.due_on, x.number))]
        out["remaining"] = cents_to_str(sum(i.remaining_cents for i in act))
        out["total"] = cents_to_str(sum(i.total_cents for i in act))
        out["overdue_count"] = sum(1 for i in out["installments"] if i["overdue"])
    return out
