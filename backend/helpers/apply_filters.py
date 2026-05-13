from datetime import datetime

from fastapi import HTTPException

from models.financial_entries import FinancialEntry
from sqlalchemy import extract


def apply_filters(
    query,
    participant_id=None,
    is_reviewed=None,
    source=None,
    own_user=None,
    date_month=None,
    date_day=None
):

    if own_user:
        query = query.filter(
            FinancialEntry.participant_id.is_(None)
        )

    if participant_id is not None:
        query = query.filter(
            FinancialEntry.participant_id == participant_id
        )

    if is_reviewed is not None:
        query = query.filter(
            FinancialEntry.is_reviewed == is_reviewed
        )

    if source is not None:
        query = query.filter(
            FinancialEntry.source == source
        )

    if date_month is not None:
        try:
            month, year = map(int, date_month.split('-'))

            query = query.filter(
                extract('year', FinancialEntry.transaction_date) == year,
                extract('month', FinancialEntry.transaction_date) == month
            )

        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Formato inválido para date_month. Use MM-YYYY"
            )

    if date_day is not None:
        try:
            day_date = datetime.strptime(
                date_day,
                '%d-%m-%Y'
            ).date()

            query = query.filter(
                FinancialEntry.transaction_date == day_date
            )

        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Formato inválido para date_day. Use DD-MM-YYYY"
            )

    return query
