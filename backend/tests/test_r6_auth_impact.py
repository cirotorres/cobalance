"""SPEC003-R8: regressões de segurança JWT R6-H, sem xfail nem relaxar asserts."""


def test_refresh_token_must_not_authorize_access_endpoint(client, a):
    pair = client.post("/auth/login", json={"email": "alice@example.test", "password": "senha-teste-123"})
    assert pair.status_code == 200
    refresh = pair.json()["refresh_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert r.status_code == 401


def test_access_token_must_not_be_usable_to_refresh(client, a):
    access = a["Authorization"].split(" ", 1)[1]
    r = client.post("/auth/refresh", json={"refresh_token": access})
    assert r.status_code == 401
