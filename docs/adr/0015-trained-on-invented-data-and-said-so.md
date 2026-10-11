# 15. The models are trained on invented data, and say so

Date: 2026-10-11
Status: accepted

## Context

A model needs data, and the demo has none that is real: no rider has carried an order,
nobody has searched, no customer has come back. The API's own demo orders are moved by
a simulator that follows the plain rule, so a model trained on them would learn the
rule back and appear to be perfect.

## Decision

- The arrival-time model learns from deliveries invented by a process that is written
  down in the code: how cooking, traffic by hour and day, a kitchen's load and rain
  each add minutes. Rain is left out of the model's inputs on purpose, because the API
  does not know the weather either.
- Search is not trained. It is measured on queries written by hand. Half are used to
  choose its one threshold and the scores are reported on the other half.
- Suggestions are learned from the seeded order history, which follows ordinary habits
  (`apps/api/src/seed/pairings.ts`). The model is given the orders, not the habits.
- Each report opens by saying what its numbers do not show, and each compares the
  model with the simple thing it replaces. One comparison is deliberately unflattering:
  it shows how much of the arrival-time gain a fitted straight line already gets.
- The reports are written by a script. No number in them is typed in.
- The same training code can read delivered orders from the API, and refuses to until
  there are enough of them.

## Consequences

- Nobody reading the project is told that a model works on Dhaka's roads. They are told
  how it was built and how it would be checked.
- The numbers measure the method on a world built for it. They would change on real
  data, and probably for the worse at first.
