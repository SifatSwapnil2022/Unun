# 5. The server prices every order, and refuses a total the customer did not see

Date: 2026-10-11
Status: accepted

## Context

The product's promise is that the price shown is the price paid. A browser can be out
of date (a menu price changed, an offer ended) or tampered with, so a total sent by the
client cannot be trusted. Silently charging the server's total instead would break the
promise from the other side.

## Decision

- `priceOrder` in `packages/core` is the only code that adds up an order. The bag in
  the browser, the quote endpoint and order placement all call it.
- The client never sends prices, only item ids and quantities.
- When placing an order the client sends `expectedTotal`, the total it displayed. The
  server prices the order again and answers `409 price_changed`, with the new quote, if
  its total differs. The checkout shows the new total and asks the customer to confirm.
- The client sends an `Idempotency-Key` with each order. A repeated request with the
  same key returns the first order instead of creating a second.
- The order row stores every part of the price, and a CHECK constraint requires the
  total to equal the sum of the parts.

## Consequences

- A customer is never charged an amount they were not shown.
- A double click or a retry on a slow connection cannot create two orders.
- The shared package must stay free of anything that only runs on one side.
