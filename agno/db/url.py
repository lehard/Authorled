"""URL of the shared PostgreSQL database, built at import from the DB_* variables."""

from core.connection import build_db_url

db_url = build_db_url()
