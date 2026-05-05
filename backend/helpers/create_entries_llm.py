from sqlalchemy.orm import Session
from helpers.find_participant import find_participant_by_name
from models.financial_entries import FinancialEntry
from models.user import User
from schemas.financial_entries import FinancialEntryCreate


def create_entries_from_llm_items(llm_entries, db: Session, current_user: User):
    created_entries = []

    for item in llm_entries:
        item_data = item.copy()
        participant_id = None
        participant_name = item_data.pop("participant_name", None)

        if participant_name:
            participant = find_participant_by_name(db, current_user, participant_name)
            participant_id = participant.id

        item_data["participant_id"] = participant_id
        financial_data = FinancialEntryCreate(**item_data)

        new_financial = FinancialEntry(
            user_id=current_user.id,
            participant_id=financial_data.participant_id,
            amount=financial_data.amount,
            transaction_date=financial_data.transaction_date,
            description=financial_data.description,
            source=financial_data.source,
            is_reviewed=financial_data.is_reviewed,
            installment_number=financial_data.installment_number,
            installment_total=financial_data.installment_total,
        )

        db.add(new_financial)
        created_entries.append(new_financial)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries