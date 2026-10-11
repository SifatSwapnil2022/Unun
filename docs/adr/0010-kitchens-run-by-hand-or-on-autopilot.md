# 10. A kitchen is run by hand or on autopilot

Date: 2026-10-11
Status: accepted

## Context

Decision 6 moved every order with a simulator, because no restaurant or rider screen
existed. Now they do. But the demo has 69 kitchens and two owner accounts. If every
order waited for a person, a visitor who ordered from most kitchens would watch nothing
happen, and the purchase flow that works today would look broken.

## Decision

- Each kitchen has an `autopilot` switch, on by default. Its owner turns it off on the
  order board.
- An order copies the switch when it is placed, so flipping it later cannot strand an
  order halfway.
- On autopilot, the order's journey is planned and stored at once, as in decision 6,
  and plays back at `DEMO_SPEED`.
- By hand, only "placed" is stored, the clock runs in real time, and people add the
  rest: the owner accepts, starts cooking and marks it ready; a rider takes it once
  cooking has started, picks it up when it is ready and delivers it.
- Both kinds are read the same way: an order's state is its latest event whose moment
  has passed. There is no status column to fall out of step.
- The rules live in `packages/core`: an order moves one step at a time and never back;
  kitchen steps belong to the kitchen and rider steps to the rider; a kitchen may
  decline only an order it has not accepted; an admin may cancel anything not yet
  delivered. The API applies them and also checks that the kitchen or the delivery
  belongs to the person asking. Somebody else's order answers "not found".
- Taking a delivery is one `UPDATE … WHERE rider_id IS NULL`, so two riders cannot both
  win it. A rider carries one order at a time.
- A cancelled order keeps the events it reached and loses the planned ones.

## Consequences

- The demo works unattended, and one order can be followed through every pair of hands.
- A kitchen run by hand with no rider signed in keeps its ready orders waiting. The
  admin can see and cancel them.
- The on-time record of a kitchen is still the seeded number. Working it out from real
  deliveries belongs with ratings, in step 5.
- Screens ask the API for news every three seconds. Pushing changes to them is a later
  improvement that needs no change to how orders are stored.
