from models.financial_entries import FinancialEntry


def apply_filters(query, current_user, participant_id, is_reviewed, source, own_user):
    query = query.filter(FinancialEntry.user_id == current_user.id)

    if own_user:
        query = query.filter(FinancialEntry.participant_id == None)

    if participant_id is not None:
        query = query.filter(FinancialEntry.participant_id == participant_id)

    if is_reviewed is not None:
        query = query.filter(FinancialEntry.is_reviewed == is_reviewed)

    if source is not None:
        query = query.filter(FinancialEntry.source == source)

    return query
