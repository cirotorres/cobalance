from models.financial_entries import FinancialEntry
from sqlalchemy import extract


def apply_filters(query, current_user, participant_id, is_reviewed, source, own_user, date_month, date_day):
    query = query.filter(FinancialEntry.user_id == current_user.id)

    if own_user:
        query = query.filter(FinancialEntry.participant_id == None)

    if participant_id is not None:
        query = query.filter(FinancialEntry.participant_id == participant_id)

    if is_reviewed is not None:
        query = query.filter(FinancialEntry.is_reviewed == is_reviewed)

    if source is not None:
        query = query.filter(FinancialEntry.source == source)

    if date_month is not None:
        try:
            month, year = map(int, date_month.split('-'))
            query = query.filter(
                extract('year', FinancialEntry.transaction_date) == year,
                extract('month', FinancialEntry.transaction_date) == month
            )
        except ValueError:
            pass

    if date_day is not None:
        try:
            from datetime import datetime
            day_date = datetime.strptime(date_day, '%d-%m-%Y').date()
            query = query.filter(FinancialEntry.transaction_date == day_date)
        except ValueError:
            pass

    return query
