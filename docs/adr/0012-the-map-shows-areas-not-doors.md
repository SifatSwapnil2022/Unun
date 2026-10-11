# 12. The tracking map shows areas, not doors

Date: 2026-10-11
Status: accepted

## Context

A customer following an order wants to see where it is. The project has no geocoder, so
a street address cannot be placed on a map, and most kitchens are moved by a simulator
that has no rider and no phone.

## Decision

- The map is Leaflet with OpenStreetMap tiles, tinted with CSS to sit in the site's
  palette. It is loaded only on the pages that show it.
- It draws three things: the kitchen, the centre of the customer's area, and the rider.
  The line between them is straight. The caption under the map says all of this.
- A rider's phone reports its position while they carry an order
  (`POST /v1/rider/location`). A position newer than three minutes is shown as theirs.
- Otherwise the position is worked out: along the simulator's plan on autopilot, or
  from the time since pickup. It is labelled an estimate, and is never drawn at the
  door before the rider says they have arrived.
- Names on the map are set as text, never as markup, and are placed so that two never
  overlap.
- Everything the map shows is also written on the page, so the page works without it.

## Consequences

- The map is honest about what it knows, and a customer is not shown a precise pin
  that was guessed.
- OpenStreetMap's public tile servers are for light use. A busy site would need its own
  tiles or a paid provider.
- Showing the real route and the real door needs a geocoder and a routing service.
