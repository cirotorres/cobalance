"""Recria o banco DESCARTÁVEL de E2E (cobalance_spec003_e2e_test). Uso exclusivo local."""
import os
import sys
from urllib.parse import urlparse

from sqlalchemy import create_engine, text

URL = os.environ["DATABASE_URL"]
p = urlparse(URL)
if os.environ.get("COBALANCE_TEST_DB_DISPOSABLE") != "1" or p.hostname not in {"127.0.0.1", "localhost"} \
        or not p.path.endswith("_e2e_test"):
    sys.exit("Recusado: banco não é o E2E descartável.")

admin = create_engine(URL.rsplit("/", 1)[0] + "/cobalance_spec003_test", isolation_level="AUTOCOMMIT")
with admin.connect() as c:
    c.execute(text("DROP DATABASE IF EXISTS cobalance_spec003_e2e_test WITH (FORCE)"))
    c.execute(text("CREATE DATABASE cobalance_spec003_e2e_test"))
admin.dispose()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.database import Base, engine  # noqa: E402
import models.user, models.participant, models.financial_entries, models.financial_entry_batches, models.loans  # noqa: E401,E402,F401

assert str(engine.url).endswith("/cobalance_spec003_e2e_test")
Base.metadata.create_all(engine)
print("e2e db ready")
