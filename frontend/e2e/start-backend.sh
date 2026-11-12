#!/usr/bin/env bash
# Sobe o backend contra o PostgreSQL DESCARTÁVEL de E2E. Nunca usa .env de produção.
set -euo pipefail
cd "$(dirname "$0")/../../backend"
export COBALANCE_TEST_DB_DISPOSABLE=1
export DATABASE_URL="postgresql://spec003_test:spec003_test@127.0.0.1:55439/cobalance_spec003_e2e_test"
export SECRET_KEY="spec003-e2e-secret-not-for-production" ALGORITHM=HS256
export CORS_EXTRA_ORIGINS="http://127.0.0.1:5179"
uv run python tests/e2e_reset_db.py
exec uv run uvicorn main:app --host 127.0.0.1 --port 18000
