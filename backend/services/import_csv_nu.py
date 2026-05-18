import pandas as pd
import re

from models.financial_entries import FinancialEntry

def import_financial_csv(file_path, db, user_id):

    df = pd.read_csv(file_path)

    imported = 0

    for _, row in df.iterrows():

        inst_num = 1
        inst_tot = 1

        match = re.search(r"(\d+)/(\d+)", row["title"])

        if match:
            inst_num = int(match.group(1))
            inst_tot = int(match.group(2))

        if row["amount"] < 0:
            continue

        entry = FinancialEntry(
            transaction_date=row["date"],
            description=row["title"],
            amount=float(row["amount"]),
            user_id=user_id,
            source="extrato",
            installment_number=inst_num,
            installment_total=inst_tot
        )

        db.add(entry)

        imported += 1

    db.commit()

    return imported



# import pandas as pd


# df = pd.read_csv("/mnt/volumez/Proj_ALL/Proj_Pessoal/BookHub/backend/documents/Nubank_2026-04-08.csv")

# lista_csv = []

# for _, row in df.iterrows():
#     lista_csv.append(row["title"])
# print(lista_csv)
