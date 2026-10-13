# 17. One Netlify site, with the API as a function

Date: 2026-10-13
Status: accepted

## Context

The project needs a public address for people to try it. On a developer's machine the
API is a long-running Node server with an embedded database on disk. Netlify runs the
web app well, but it runs back-end code as short-lived functions: no process stays up
between requests, and nothing written to disk survives.

## Decision

- One Netlify site serves both parts. The web app is built by Netlify's Next.js adapter.
  The Hono API is compiled into one Netlify function, `api`, and the web app reaches it
  at `/.netlify/functions/api`. The browser keeps calling `/api/*`.
- The data lives in PostgreSQL: Netlify Database where the account offers it, or any
  server named by `DATABASE_URL`. The embedded database is for development only.
- The build applies migrations and loads the demo data (`db:deploy`) before it builds
  the site. A function that starts cold only opens a connection, so it does not pay for
  migrations on a visitor's request.
- The API needed no rewrite. Order progress was already stored as timed events and read
  against the clock (decision 6), so there is no background loop to keep alive.
- The Python service is off on Netlify, which runs no Python. The API already falls back
  to plain rules without it (decision 14). `ML_URL` turns it back on if it is hosted
  elsewhere.

## Consequences

- The site, the API and the database deploy from one push, under one account.
- The limits kept in memory, such as requests per minute, apply per function instance,
  not across all of them. That is enough for a demo; real traffic would need a shared
  store.
- A visitor who arrives after a quiet spell waits for a cold start and, depending on the
  database plan, for the database to wake.
- The demo data is loaded once. It does not reset itself, so orders placed by visitors
  stay until the database is cleared.
