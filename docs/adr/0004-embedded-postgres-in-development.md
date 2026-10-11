# 4. PostgreSQL everywhere, embedded in development

Date: 2026-10-11
Status: accepted

## Context

Decision 1 chose PostgreSQL. A reviewer who clones the repository should be able to run
it with two commands, and installing a database server or Docker first is a common
reason people give up. SQLite would remove that step, but then development and
production would run different SQL, and the CHECK constraints, enums and array columns
the schema relies on would behave differently or not exist.

## Decision

- The schema and migrations are written for PostgreSQL only.
- With `DATABASE_URL` set, the API connects to that PostgreSQL server.
- Without it, the API runs PGlite, PostgreSQL compiled to WebAssembly, inside its own
  process and keeps the data in `apps/api/.data`.
- Tests start a fresh in-memory PGlite for each file and call the real endpoints.
- The embedded database is filled with demo data once, when it is empty. A file beside
  it records which version of the demo data filled it (`SEED_VERSION`). When the code
  carries a newer version, the embedded database is deleted and built again on start.
  A real PostgreSQL server is never reset this way.
- Delivery distance is calculated in application code (haversine) for now. PostGIS,
  named in decision 1, is postponed until street addresses and delivery zones arrive
  in step 4, because PGlite does not ship it.

## Consequences

- `pnpm install` and `pnpm dev` are the whole setup.
- Updating the project never leaves old demo data behind, at the cost of losing the
  orders placed in the embedded database before the update.
- The same migrations and queries run in development, in tests and in production.
- PGlite is one connection and slower than a server, which is fine for one developer
  and unsuitable for production. Production must set `DATABASE_URL`.
- The Drizzle query builder is shared by both drivers. Raw `execute` results differ
  between them, so the code does not use raw queries.
