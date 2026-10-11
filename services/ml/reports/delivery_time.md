# Arrival time: what the model adds

Written by `python -m unun_ml.evaluate`. Do not edit by hand.

## Read this first

These numbers come from invented deliveries. Unun is a demo and has no real ones.
`synthesize` in `unun_ml/delivery.py` makes the orders, and its assumptions about
Dhaka traffic, busy kitchens and rain are written there in plain words. So the table
shows that the method works on a world built to behave like delivery. It does not
show how the model would do on real roads. That needs real order events, which the
same code can be trained on.

## The comparison

Trained on 60,000 orders, measured on 20,000 others the model never saw.

| Method | Typical miss | Inside the window | Late | Window width |
| --- | --- | --- | --- | --- |
| The plain rule | 5.3 min | 54% | 34% | 9.0 min |
| The rule's shape, fitted to the data | 5.0 min | 79% | 11% | 15.6 min |
| Gradient boosting, all six inputs | 3.9 min | 79% | 11% | 12.2 min |

- **Typical miss** is the average gap between the middle of the estimate and the real
  arrival.
- **Inside the window** is the share of orders that arrived between the two ends shown
  to the customer. The model aims for 80%: one order in ten early, one in ten late.
- **Late** is the share that arrived after the window closed. This is the number a
  customer feels.

The second row matters. It keeps the plain rule's two inputs and only fits its numbers,
which already fixes most of the lateness, by making the window wider. The third row is
what the hour, the day and the kitchen's load add on top: a typical miss 1.2 minutes smaller, and a window
3.4 minutes narrower for the same share of late orders.

## Late orders by time of day

A fixed rule is wrong in the same direction at the same hours. This is where the
model earns its place.

| When | Orders | Late with the plain rule | Late with the model |
| --- | --- | --- | --- |
| Morning rush, 8 to 10 | 1,495 | 21% | 11% |
| Lunch, 12 to 3 | 5,612 | 39% | 10% |
| Afternoon, 3 to 5 | 572 | 19% | 12% |
| Evening rush, 5 to 9 | 5,597 | 54% | 11% |
| Late, after 10 | 2,569 | 12% | 10% |

## What the model leans on

How much worse the typical miss gets when one input is shuffled, so that the model
can no longer use it.

| Input | Minutes of accuracy lost without it |
| --- | --- |
| Distance | 4.84 |
| Kitchen's cooking time | 4.73 |
| Orders the kitchen has on | 0.89 |
| Hour of the day | 0.67 |
| Dishes in the order | 0.36 |
| Day of the week | 0.07 |

## How the API uses it

The window shown to a customer runs from the model's fast end to its slow end. The
API keeps that answer near the plain rule (see `toWindow` in
`apps/api/src/modules/ml/eta.ts`) and falls back to the rule whenever this service
is not running, is slow, or answers something that makes no sense.
