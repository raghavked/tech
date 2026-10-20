-- Henosis on Supabase Postgres (docs/20_hosting.md). Run once in the project's SQL editor,
-- after replacing :password with the password the server will connect with. Everything here
-- is idempotent, so running it again is harmless.
--
-- The store lives in its own schema, `henosis`, as the three tables PostgresStore's
-- ensureSchema() creates (packages/server/src/store/postgresStore.ts); the server connects
-- as the login role `henosis_app`, whose search_path puts that schema first, so the store's
-- unqualified table names land there and nothing is created in `public`.

create schema if not exists henosis;

create table if not exists henosis.branches (
  kind text not null,
  log_id text not null,
  name text not null,
  parent text,
  fork_point text,
  created_seq integer not null,
  ord integer not null,
  primary key (kind, log_id, name)
);

create table if not exists henosis.events (
  kind text not null,
  log_id text not null,
  branch text not null,
  seq integer not null,
  event jsonb not null,
  primary key (kind, log_id, branch, seq)
);

create table if not exists henosis.docs (
  name text primary key,
  json jsonb not null
);

-- The role the server connects as. Replace :password before running.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'henosis_app') then
    create role henosis_app login password ':password';
  else
    alter role henosis_app with login password ':password';
  end if;
end
$$;

alter role henosis_app set search_path = henosis, public;

grant usage, create on schema henosis to henosis_app;
grant select, insert, update, delete on all tables in schema henosis to henosis_app;
grant usage, select on all sequences in schema henosis to henosis_app;
alter default privileges in schema henosis grant select, insert, update, delete on tables to henosis_app;
alter default privileges in schema henosis grant usage, select on sequences to henosis_app;

-- The tables above were created by the role running this file; let the server own them too,
-- so a later ensureSchema() (create table if not exists) and any index it adds succeed.
alter table henosis.branches owner to henosis_app;
alter table henosis.events owner to henosis_app;
alter table henosis.docs owner to henosis_app;
