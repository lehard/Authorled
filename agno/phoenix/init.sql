-- Idempotent bootstrap of the role and schema of Phoenix, the journal of agent runs
-- (openspec/specs/agent-tracing). Run by the phoenix-db-init service under the bootstrap user with
--   psql -v ON_ERROR_STOP=1 -v phoenix_password=... -f init.sql
-- The role owns only schema `phoenix` and gets no grants on `ai`, `authorled`, `billing` or
-- `authentik`, so PostgreSQL denies it the data of the product; the API role `agentos` gets no
-- grants on `phoenix`.

SELECT format('CREATE ROLE phoenix LOGIN PASSWORD %L', :'phoenix_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'phoenix')
\gexec

ALTER ROLE phoenix WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    PASSWORD :'phoenix_password';

-- Phoenix runs CREATE SCHEMA IF NOT EXISTS phoenix before its migrations; PostgreSQL checks CREATE
-- on the database before it checks whether the schema exists. The database is the one this script
-- connects to, never a name written here. Its tables stay in `phoenix`.
SELECT format('GRANT CREATE ON DATABASE %I TO phoenix', current_database())
\gexec

CREATE SCHEMA IF NOT EXISTS phoenix AUTHORIZATION phoenix;
ALTER SCHEMA phoenix OWNER TO phoenix;

ALTER ROLE phoenix SET search_path = phoenix;
