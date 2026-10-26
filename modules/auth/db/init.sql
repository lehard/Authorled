-- Idempotent bootstrap of the Authentik role and schema in the shared database.
-- Run by the authentik-db-init service under the bootstrap user with
--   psql -v ON_ERROR_STOP=1 -v authentik_password=... -f init.sql
-- The role gets no grants on the ai schema (owned by Agno): PostgreSQL denies it by default.
-- Authentik 2026.8 also needs CREATE on the database (it creates the `template` schema)
-- and CREATE on `public` (django-pgtrigger functions); its tables stay in `authentik`.

SELECT format('CREATE ROLE authentik LOGIN PASSWORD %L', :'authentik_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authentik')
\gexec

ALTER ROLE authentik PASSWORD :'authentik_password';

CREATE SCHEMA IF NOT EXISTS authentik AUTHORIZATION authentik;

ALTER ROLE authentik SET search_path = authentik;

GRANT CREATE ON DATABASE ai TO authentik;
GRANT CREATE ON SCHEMA public TO authentik;
