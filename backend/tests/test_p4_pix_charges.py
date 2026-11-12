"""P4 — Pix BR Code estático (CRC/TLV) e cobranças com snapshot, sem inferir pagamento."""
from loans.pix import build_brcode, crc16_ccitt, parse_tlv, verify_crc
from test_p3_receipts import borrower, funded, pay

BCB_EXAMPLE = ("00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR"
               "5913Fulano de Tal6008BRASILIA62070503***63041D3D")


def test_crc_standard_check_value():
    assert crc16_ccitt(b"123456789") == 0x29B1


def test_crc_matches_bcb_manual_example():
    assert verify_crc(BCB_EXAMPLE)
    assert not verify_crc(BCB_EXAMPLE[:-1] + "E")


def test_build_brcode_structure():
    code = build_brcode(key="alice@example.test", holder_name="Alice Ça Teste", city="Fortaleza", amount_cents=115000, txid="COBAL1")
    assert verify_crc(code)
    t = parse_tlv(code)
    assert t["00"] == "01" and t["52"] == "0000" and t["53"] == "986" and t["54"] == "1150.00" and t["58"] == "BR"
    assert t["59"] == "Alice Ca Teste" and t["60"] == "Fortaleza"
    mai = parse_tlv(t["26"])
    assert mai == {"00": "br.gov.bcb.pix", "01": "alice@example.test"}
    assert parse_tlv(t["62"]) == {"05": "COBAL1"}


def test_build_brcode_reproduces_bcb_example_without_amount():
    code = build_brcode(key="123e4567-e12b-12d1-a456-426655440000", holder_name="Fulano de Tal", city="BRASILIA",
                        amount_cents=None, txid="***")
    assert code == BCB_EXAMPLE


PIX = {"label": "Nubank", "key": "alice@example.test", "holder_name": "Alice Teste", "city": "Fortaleza"}


def test_charge_consolidated_with_default_pix_and_snapshot(client, a):
    pix1 = client.post("/loans/pix-accounts", json=PIX, headers=a).json()
    pix2 = client.post("/loans/pix-accounts", json={**PIX, "label": "Inter", "key": "+5585999998888"}, headers=a).json()
    bid = borrower(client, a)
    l1, l2 = funded(client, a, bid), funded(client, a, bid, principal="1000.00", n=4)
    ids = [l1["installments"][0]["id"], l2["installments"][0]["id"]]
    r = client.post("/loans/charges", json={"borrower_id": bid, "installment_ids": ids}, headers=a)
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["pix_account_id"] == pix1["id"] and c["total"] == "1450.00" and c["status"] == "GENERATED"
    assert verify_crc(c["brcode"]) and parse_tlv(c["brcode"])["54"] == "1450.00"
    assert "R$ 1.450,00" in c["message"] and c["is_payment_confirmation"] is False
    # gerar/compartilhar NÃO quita nada
    assert client.post(f"/loans/charges/{c['id']}/shared", headers=a).json()["status"] == "SHARED"
    d = client.get(f"/loans/contracts/{l1['id']}", headers=a).json()
    assert d["installments"][0]["status"] == "PENDING"
    assert client.get("/loans/receipts", headers=a).json() == []
    # alternativa explícita
    r2 = client.post("/loans/charges", json={"borrower_id": bid, "installment_ids": ids[:1], "pix_account_id": pix2["id"]}, headers=a).json()
    assert parse_tlv(parse_tlv(r2["brcode"])["26"])["01"] == "+5585999998888"
    # snapshot: editar conta não altera cobrança histórica
    client.patch(f"/loans/pix-accounts/{pix1['id']}", json={"holder_name": "Outro Nome"}, headers=a)
    assert client.get(f"/loans/charges/{c['id']}", headers=a).json()["holder_name"] == "Alice Teste"
    # pago depois → cobrança sinaliza divergência
    pay(client, a, bid, [{"installment_id": ids[0]}], "1150.00")
    after = client.get(f"/loans/charges/{c['id']}", headers=a).json()
    assert after["values_may_have_changed"] is True and after["total"] == "1450.00"


def test_charge_requires_pix_and_same_borrower(client, a):
    b1, b2 = borrower(client, a), borrower(client, a, "Lívia")
    l1, l2 = funded(client, a, b1), funded(client, a, b2)
    ids = [l1["installments"][0]["id"]]
    assert client.post("/loans/charges", json={"borrower_id": b1, "installment_ids": ids}, headers=a).status_code == 409
    client.post("/loans/pix-accounts", json=PIX, headers=a)
    mixed = ids + [l2["installments"][0]["id"]]
    assert client.post("/loans/charges", json={"borrower_id": b1, "installment_ids": mixed}, headers=a).status_code == 422
    pay(client, a, b1, [{"installment_id": ids[0]}], "1150.00")
    assert client.post("/loans/charges", json={"borrower_id": b1, "installment_ids": ids}, headers=a).status_code == 409


def test_charge_cross_user_isolation(client, a, b):
    client.post("/loans/pix-accounts", json=PIX, headers=a)
    pix_b = client.post("/loans/pix-accounts", json={**PIX, "key": "b@b.co"}, headers=b).json()
    bid = borrower(client, a)
    l1 = funded(client, a, bid)
    ids = [l1["installments"][0]["id"]]
    c = client.post("/loans/charges", json={"borrower_id": bid, "installment_ids": ids}, headers=a).json()
    assert client.get(f"/loans/charges/{c['id']}", headers=b).status_code == 404
    assert client.post(f"/loans/charges/{c['id']}/shared", headers=b).status_code == 404
    assert client.get("/loans/charges", headers=b).json() == []
    bb = borrower(client, b, "Bruno")
    assert client.post("/loans/charges", json={"borrower_id": bb, "installment_ids": ids}, headers=b).status_code == 404
    assert client.post("/loans/charges", json={"borrower_id": bid, "installment_ids": ids, "pix_account_id": pix_b["id"]}, headers=a).status_code == 404
