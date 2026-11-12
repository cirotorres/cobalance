"""P1 / R1 — módulos, ownership, isolamento Cartões x Empréstimos, Pix default."""
from conftest import make_user, enable_loans


def test_modules_default_fallback_for_legacy_user(client, user_a):
    r = client.get("/modules/me", headers=user_a)
    assert r.status_code == 200
    assert r.json() == {"cards_enabled": True, "loans_enabled": False, "default_module": "cards"}


def test_modules_requires_auth(client):
    assert client.get("/modules/me").status_code == 401


def test_modules_patch_rejects_extra_fields_and_owner(client, user_a):
    r = client.patch("/modules/me", json={"loans_enabled": True, "user_id": 99}, headers=user_a)
    assert r.status_code == 422


def test_modules_cannot_disable_all_or_default_disabled(client, user_a):
    assert client.patch("/modules/me", json={"cards_enabled": False}, headers=user_a).status_code == 422
    assert client.patch("/modules/me", json={"default_module": "loans"}, headers=user_a).status_code == 422
    r = client.patch("/modules/me", json={"loans_enabled": True, "default_module": "loans"}, headers=user_a)
    assert r.status_code == 200 and r.json()["default_module"] == "loans"
    # desativar loans enquanto default → default volta a cards automaticamente? Não: deve ser explícito
    assert client.patch("/modules/me", json={"loans_enabled": False}, headers=user_a).status_code == 422


def test_loans_endpoints_403_when_module_disabled(client, user_a):
    assert client.get("/loans/borrowers", headers=user_a).status_code == 403
    assert client.post("/loans/borrowers", json={"name": "X"}, headers=user_a).status_code == 403


def test_disabling_loans_hides_but_keeps_data(client, a):
    bid = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a).json()["id"]
    client.patch("/modules/me", json={"loans_enabled": False}, headers=a)
    assert client.get(f"/loans/borrowers/{bid}", headers=a).status_code == 403
    enable_loans(client, a)
    assert client.get(f"/loans/borrowers/{bid}", headers=a).json()["name"] == "Cleide"


def test_borrower_crud_and_validation(client, a):
    r = client.post("/loans/borrowers", json={"name": "  Cleide  ", "contact": "85 9999", "note": "n"}, headers=a)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Cleide" and body["archived"] is False
    assert client.post("/loans/borrowers", json={"name": ""}, headers=a).status_code == 422
    assert client.post("/loans/borrowers", json={"name": "x" * 121}, headers=a).status_code == 422
    assert client.post("/loans/borrowers", json={"name": "Y", "user_id": 2}, headers=a).status_code == 422
    r = client.patch(f"/loans/borrowers/{body['id']}", json={"archived": True}, headers=a)
    assert r.status_code == 200 and r.json()["archived"] is True
    assert client.get("/loans/borrowers", headers=a).json() == []
    assert len(client.get("/loans/borrowers?include_archived=true", headers=a).json()) == 1


def test_duplicate_active_borrower_name_conflicts(client, a):
    assert client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a).status_code == 201
    assert client.post("/loans/borrowers", json={"name": "cleide"}, headers=a).status_code == 409


def test_same_name_in_cards_and_loans_are_independent(client, a):
    p = client.post("/participants/", json={"name": "Cleide"}, headers=a)
    assert p.status_code == 200
    bor = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a)
    assert bor.status_code == 201
    parts = client.get("/participants/self", headers=a).json()
    assert [x["name"] for x in parts] == ["Cleide"]
    assert len(client.get("/loans/borrowers", headers=a).json()) == 1
    # arquivar tomador não mexe no participante
    client.patch(f"/loans/borrowers/{bor.json()['id']}", json={"archived": True}, headers=a)
    assert len(client.get("/participants/self", headers=a).json()) == 1


def test_same_name_across_users_independent(client, a, b):
    ra = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a).json()
    rb = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=b).json()
    assert ra["id"] != rb["id"]
    assert [x["id"] for x in client.get("/loans/borrowers", headers=b).json()] == [rb["id"]]


def test_cross_user_borrower_access_is_404(client, a, b):
    bid = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a).json()["id"]
    assert client.get(f"/loans/borrowers/{bid}", headers=b).status_code == 404
    assert client.patch(f"/loans/borrowers/{bid}", json={"name": "hack"}, headers=b).status_code == 404
    assert client.get(f"/loans/borrowers/{bid}/statement", headers=b).status_code == 404


def test_admin_has_no_bypass(client, a):
    admin = make_user(client, "root@example.test", is_admin=True)
    enable_loans(client, admin)
    bid = client.post("/loans/borrowers", json={"name": "Cleide"}, headers=a).json()["id"]
    assert client.get(f"/loans/borrowers/{bid}", headers=admin).status_code == 404
    assert client.get("/loans/borrowers", headers=admin).json() == []


PIX = {"label": "Nubank", "key": "alice@example.test", "holder_name": "Alice Teste", "city": "Fortaleza"}


def test_pix_first_account_becomes_default_and_single_default(client, a):
    p1 = client.post("/loans/pix-accounts", json=PIX, headers=a)
    assert p1.status_code == 201 and p1.json()["is_default"] is True
    p2 = client.post("/loans/pix-accounts", json={**PIX, "label": "Inter", "key": "+5585999998888"}, headers=a).json()
    assert p2["is_default"] is False
    r = client.post(f"/loans/pix-accounts/{p2['id']}/default", headers=a)
    assert r.status_code == 200
    accts = client.get("/loans/pix-accounts", headers=a).json()
    assert [x["is_default"] for x in sorted(accts, key=lambda x: x["id"])] == [False, True]


def test_pix_key_validation(client, a):
    bad = ["", "nao-e-chave", "123", "52998224726", "+55859"]  # CPF com DV inválido
    for k in bad:
        assert client.post("/loans/pix-accounts", json={**PIX, "key": k}, headers=a).status_code == 422, k
    good = ["52998224725", "11.222.333/0001-81", "+5585999998888", "a@b.co", "123e4567-e89b-42d3-a456-426614174000"]
    for k in good:
        assert client.post("/loans/pix-accounts", json={**PIX, "key": k}, headers=a).status_code == 201, k
    assert client.post("/loans/pix-accounts", json={**PIX, "city": ""}, headers=a).status_code == 422


def test_pix_key_masked_in_listing(client, a):
    client.post("/loans/pix-accounts", json={**PIX, "key": "52998224725"}, headers=a)
    acc = client.get("/loans/pix-accounts", headers=a).json()[0]
    assert acc["key_masked"] != "52998224725" and "529" not in acc["key_masked"][3:]


def test_deactivating_default_requires_new_default_when_others(client, a):
    p1 = client.post("/loans/pix-accounts", json=PIX, headers=a).json()
    p2 = client.post("/loans/pix-accounts", json={**PIX, "key": "+5585999998888"}, headers=a).json()
    r = client.patch(f"/loans/pix-accounts/{p1['id']}", json={"is_active": False}, headers=a)
    assert r.status_code == 409
    client.post(f"/loans/pix-accounts/{p2['id']}/default", headers=a)
    assert client.patch(f"/loans/pix-accounts/{p1['id']}", json={"is_active": False}, headers=a).status_code == 200
    # conta inativa não pode virar default
    assert client.post(f"/loans/pix-accounts/{p1['id']}/default", headers=a).status_code == 409


def test_deactivating_only_default_allowed(client, a):
    p1 = client.post("/loans/pix-accounts", json=PIX, headers=a).json()
    r = client.patch(f"/loans/pix-accounts/{p1['id']}", json={"is_active": False}, headers=a)
    assert r.status_code == 200 and r.json()["is_default"] is False


def test_pix_cross_user_404(client, a, b):
    p1 = client.post("/loans/pix-accounts", json=PIX, headers=a).json()
    assert client.patch(f"/loans/pix-accounts/{p1['id']}", json={"label": "x"}, headers=b).status_code == 404
    assert client.post(f"/loans/pix-accounts/{p1['id']}/default", headers=b).status_code == 404
    assert client.get("/loans/pix-accounts", headers=b).json() == []


def test_legacy_cards_flow_unaffected(client, user_a):
    # login/refresh/me/participants continuam
    r = client.post("/auth/login", json={"email": "alice@example.test", "password": "senha-teste-123"})
    rt = r.json()["refresh_token"]
    assert client.post("/auth/refresh", json={"refresh_token": rt}).status_code == 200
    assert client.get("/auth/me", headers=user_a).status_code == 200
    assert client.post("/participants/", json={"name": "Zé"}, headers=user_a).status_code == 200
    assert client.get("/participants/self", headers=user_a).status_code == 200
    assert client.get("/financial/financial-entries", headers=user_a).status_code == 200
