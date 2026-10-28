-- Idempotent bootstrap of the role the API connects with (openspec/specs/architecture,
-- "Подключение к БД"). Run by the agentos-db-init service under the bootstrap superuser with
--   psql -v ON_ERROR_STOP=1 -v agentos_password=... -f init.sql
-- The role is not a superuser: it owns schema `ai` and gets no grants on schema `authentik`
-- (owned by the role of the auth module), so PostgreSQL denies it the Authentik data.

SELECT format('CREATE ROLE agentos LOGIN PASSWORD %L', :'agentos_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agentos')
\gexec

ALTER ROLE agentos WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    PASSWORD :'agentos_password';

-- Agno runs CREATE SCHEMA IF NOT EXISTS ai on start; PostgreSQL checks CREATE on the database
-- before it checks whether the schema exists.
GRANT CREATE ON DATABASE ai TO agentos;

CREATE SCHEMA IF NOT EXISTS ai AUTHORIZATION agentos;
ALTER SCHEMA ai OWNER TO agentos;

-- Agno runs CREATE EXTENSION IF NOT EXISTS vector, which needs a superuser only when the
-- extension is missing. An existing extension stays in its schema.
CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;

-- Tables, views and sequences the bootstrap user created in `ai` before this role existed.
-- Indexes and sequences owned by a column follow their table; extension members are left alone.
DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
        SELECT c.oid::regclass AS name, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'ai'
          AND c.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
          AND c.relowner <> 'agentos'::regrole
          AND NOT EXISTS (
              SELECT FROM pg_depend d
              WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype IN ('e', 'a', 'i')
          )
    LOOP
        EXECUTE format(
            CASE obj.relkind
                WHEN 'v' THEN 'ALTER VIEW %s OWNER TO agentos'
                WHEN 'm' THEN 'ALTER MATERIALIZED VIEW %s OWNER TO agentos'
                WHEN 'S' THEN 'ALTER SEQUENCE %s OWNER TO agentos'
                ELSE 'ALTER TABLE %s OWNER TO agentos'
            END,
            obj.name
        );
    END LOOP;

    FOR obj IN
        SELECT p.oid::regprocedure AS name
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'ai'
          AND p.proowner <> 'agentos'::regrole
          AND NOT EXISTS (
              SELECT FROM pg_depend d
              WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format('ALTER ROUTINE %s OWNER TO agentos', obj.name);
    END LOOP;

    FOR obj IN
        SELECT t.oid::regtype AS name
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'ai'
          AND t.typowner <> 'agentos'::regrole
          AND (t.typtype IN ('e', 'd') OR (t.typtype = 'c' AND (SELECT relkind FROM pg_class WHERE oid = t.typrelid) = 'c'))
          AND NOT EXISTS (
              SELECT FROM pg_depend d
              WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format('ALTER TYPE %s OWNER TO agentos', obj.name);
    END LOOP;
END
$$;

-- The vector type resolves wherever the extension lives (public on a new database).
ALTER ROLE agentos SET search_path = ai, public;
