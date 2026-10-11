# 6. Order progress is simulated until the restaurant and rider apps exist

Date: 2026-10-11
Status: amended by decision 10

## Context

An order is moved from "placed" to "delivered" by people: the kitchen accepts and cooks
it, a rider collects and delivers it. Those apps are step 4. Without them a placed
order would never change, and the tracking page and the on-time result could not be
shown or tested.

## Decision

- When an order is placed, the API plans its whole journey with `planTimeline` and
  stores one `order_events` row per state, each with the moment it is reached.
- An order's current state is the latest stored state whose moment has passed. Nothing
  runs in the background.
- Whether the order arrives inside its window is drawn at random, weighted by the
  kitchen's on-time record, so late orders happen and the page can show them honestly.
- `DEMO_SPEED` compresses time. Each order records the speed it ran at, and the API
  reports event times in order time, so the page reads the same at any speed.

## Consequences

- The tracking page, the arrival result and their tests work today.
- In step 4 the planner is removed: the restaurant and rider apps will write each
  `order_events` row when the state is really reached. The table, the state rules in
  `packages/core` and the tracking page stay as they are.

## What changed

Step 3 added the restaurant owner's and the rider's screens. The planner was kept
rather than removed, as decision 10 explains: most demo kitchens have nobody at their
screen, so the simulator still moves their orders, and a kitchen's owner can switch it
off.
