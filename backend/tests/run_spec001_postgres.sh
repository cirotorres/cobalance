#!/usr/bin/env bash
# Exclusivamente PostgreSQL efêmero criado/descartado por pg_virtualenv.
set -euo pipefail
cd "$(dirname "$0")/.."
pg_virtualenv -v 16 bash -c '
    set -euo pipefail
    db_name="cobalance_spec001_test_${BASHPID}"
    createdb "$db_name"
    export COBALANCE_SPEC001_TEST_DATABASE_URL="postgresql+psycopg2:///${db_name}?host=${PGHOST}&port=${PGPORT}"
    export COBALANCE_ALEMBIC_DATABASE_URL="$COBALANCE_SPEC001_TEST_DATABASE_URL"
    export DATABASE_URL="$COBALANCE_SPEC001_TEST_DATABASE_URL"
    export SECRET_KEY="spec001-local-tests-only-strong-32-bytes"
    export ALGORITHM="HS256"
    export PYTHONPATH=.
    /home/ciro/dev/prog/cobalance/backend/.venv/bin/python -m unittest discover -s tests -p "test_spec001_*.py" -v
'
