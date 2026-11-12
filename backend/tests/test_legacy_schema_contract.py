"""Contrato ORM das três tabelas legadas, conforme PostgreSQL Neon.

Teste de metadados apenas: não abre conexão e não modifica banco.
"""
import unittest

from sqlalchemy import BigInteger

from db.database import Base
from models.user import User  # noqa: F401
from models.participant import Participant  # noqa: F401
from models.financial_entries import FinancialEntry  # noqa: F401
from models.financial_entry_batches import FinancialEntryBatch  # noqa: F401


class LegacyNeonSchemaContract(unittest.TestCase):
    def test_legacy_identifiers_use_bigint(self):
        expected = {
            "users": ("id",),
            "participants": ("id", "user_id"),
            "financial_entries": ("id", "user_id", "participant_id"),
        }
        for table, columns in expected.items():
            for column in columns:
                with self.subTest(table=table, column=column):
                    self.assertIsInstance(Base.metadata.tables[table].c[column].type, BigInteger)

    def test_preserves_existing_financial_indexes(self):
        indices = {
            index.name: tuple(c.name for c in index.columns)
            for index in Base.metadata.tables["financial_entries"].indexes
        }
        for name, columns in {
            "idx_financial_date": ("transaction_date",),
            "idx_financial_participant": ("participant_id",),
            "idx_financial_user": ("user_id",),
            "ix_financial_entries_batch_id": ("batch_id",),
        }.items():
            with self.subTest(index=name):
                self.assertEqual(indices.get(name), columns)
        self.assertNotIn("ix_financial_entries_id", indices)

    def test_preserves_foreign_key_names_and_ondelete(self):
        expected = {
            ("participants", "user_id"): ("fk_participant_user", "CASCADE"),
            ("financial_entries", "user_id"): ("fk_financial_user", "CASCADE"),
            ("financial_entries", "participant_id"): ("fk_financial_participant", "SET NULL"),
        }
        for (table, column), (name, rule) in expected.items():
            with self.subTest(table=table, column=column):
                key = next(iter(Base.metadata.tables[table].c[column].foreign_keys))
                self.assertEqual(key.constraint.name, name)
                self.assertEqual(key.ondelete, rule)


if __name__ == "__main__":
    unittest.main()
