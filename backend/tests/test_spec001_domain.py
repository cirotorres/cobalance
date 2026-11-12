"""SPEC001: dinheiro e datas sem dependência de banco."""

import unittest
from datetime import date

from pydantic import ValidationError

from schemas.installment_purchases import InstallmentPurchaseCreate
from services.installment_purchases import allocate_installments, monthly_date


def payload(**changes):
    data = dict(
        participant_id=1, amount="300.01", transaction_date="2027-01-31",
        description=" LOJA ", source="credito", installment_total=3,
    )
    data.update(changes)
    return data


class InstallmentDomainTests(unittest.TestCase):
    def test_centavos_exatos_e_parcela_unica(self):
        self.assertEqual(allocate_installments(30001, 3), [10001, 10000, 10000])
        self.assertEqual(allocate_installments(4, 3), [2, 1, 1])
        self.assertEqual(allocate_installments(9999999999, 1), [9999999999])

    def test_calendario_original_sem_deriva(self):
        self.assertEqual([monthly_date(date(2027, 1, 31), i) for i in range(3)],
                         [date(2027, 1, 31), date(2027, 2, 28), date(2027, 3, 31)])
        self.assertEqual([monthly_date(date(2028, 1, 31), i) for i in range(3)],
                         [date(2028, 1, 31), date(2028, 2, 29), date(2028, 3, 31)])

    def test_schema_normaliza_sem_float(self):
        data = InstallmentPurchaseCreate.model_validate(payload())
        self.assertEqual(data.amount_cents, 30001)
        self.assertEqual(data.description, "LOJA")
        self.assertEqual(data.transaction_date, date(2027, 1, 31))
        self.assertEqual(InstallmentPurchaseCreate.model_validate(payload(amount="300.0")).amount_cents, 30000)

    def test_schema_rejeita_inputs_invalidos(self):
        invalid = [
            dict(amount=300.01), dict(amount=True), dict(amount="1e2"),
            dict(amount="1,00"), dict(amount="0"), dict(amount="-1"),
            dict(amount="3.001"), dict(amount="100000000.00"),
            dict(amount="0.02"), dict(installment_total=37),
            dict(installment_total=0), dict(installment_total=True),
            dict(installment_total="3"), dict(participant_id=0),
            dict(participant_id=True), dict(source="pix"),
            dict(source="extrato"), dict(description="  "),
            dict(description="x" * 256), dict(transaction_date="2027-02-30"),
            dict(transaction_date="2027-01-01T00:00:00"), dict(user_id=99),
            dict(is_reviewed=True), dict(installment_number=2),
        ]
        for case in invalid:
            with self.subTest(case=case), self.assertRaises(ValidationError):
                InstallmentPurchaseCreate.model_validate(payload(**case))

    def test_data_estourada(self):
        with self.assertRaises(ValidationError):
            InstallmentPurchaseCreate.model_validate(payload(transaction_date="9999-12-31", installment_total=2))

    def test_amount_length_bounded_before_decimal(self):
        for value in ("9" * 1_000_000, "100000000", "000000000", "99999999.999"):
            with self.assertRaises(ValidationError):
                InstallmentPurchaseCreate.model_validate(payload(amount=value))
        self.assertEqual(InstallmentPurchaseCreate.model_validate(
            payload(amount="99999999.99", installment_total=1)).amount_cents, 9_999_999_999)


if __name__ == "__main__":
    unittest.main()
