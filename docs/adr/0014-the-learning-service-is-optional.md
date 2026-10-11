# 14. The learning service is optional, and its answers are guarded

Date: 2026-10-11
Status: accepted

## Context

Arrival times, search and suggestions are better with a model than with a rule. They
are written in Python, where the tools for that live. But a food order must not fail
because a model did, and a model can be wrong in ways a rule cannot.

## Decision

- The models run in a separate service, `services/ml`, that only the API calls.
- Every call has a 700 ms limit. A failure of any kind, including an answer in the
  wrong shape, comes back as "no answer" and starts a fifteen-second rest, during which
  the service is not asked again.
- With no answer the API uses its own plain rule: the arrival window from
  `packages/core`, a search for the letters as typed, the kitchen's best sellers.
- A predicted window is kept near the plain rule before it is shown: never much sooner,
  never much later, never too narrow to survive an ordinary delay.
- The window an order is promised is the one its quote showed, and is stored with it.
- The service reads menus and finished orders from two internal addresses of the API,
  which take a shared key and leave out names, numbers and addresses. For a customer's
  picks the API sends only the names of dishes.
- `pnpm dev` starts the service when it has been set up, and says so when it has not.

## Consequences

- The site runs on a machine with no Python, and survives the service stopping.
- Two programs must agree on a contract. It is checked on the API's side with schemas,
  and by tests that stand in for the service and make it fail.
- The same kitchen can show a slightly different window an hour later. That is the
  point of the model.
