# 1. One repository, one backend, a separate ML service

Date: 2026-10-11
Status: accepted

## Context

Unun has four sides (customer, restaurant, rider, admin) and three machine-learning
features. One person builds it. An earlier attempt split the backend into microservices
and stopped after a single auth service, which issued tokens without checking credentials.

## Decision

- Keep everything in one repository with pnpm workspaces.
- Build one backend service, split into modules by domain (auth, catalogue, orders,
  pricing, promotions, payments, dispatch, ledger).
- Put the models in a separate Python service, because they need a different language
  and are deployed on a different schedule.
- Use PostgreSQL with PostGIS for data, because orders, payments and the ledger need
  transactions and constraints, and delivery zones need geometry.

## Consequences

- One deploy and one database make end-to-end tests cheap.
- Module boundaries must be enforced by code review and import rules, since nothing
  physical separates them.
- If a module ever needs to scale on its own, it can be extracted along its boundary.
