# 2. Money is whole paisa, and one function prices an order

Date: 2026-10-11
Status: accepted

## Context

The product promise is that the price shown is the price paid. That fails if two parts of
the system calculate a total in two ways, or if floating-point taka drifts by a paisa.

## Decision

- Hold every amount as an integer number of paisa. Convert to taka only when formatting.
- Calculate an order total in exactly one function, `priceOrder`. Dish pages, the bag,
  the receipt and later the API all call it.
- Round VAT to whole taka, halves up, because customers pay in whole taka.
- Reject fractional or negative inputs with an error instead of correcting them silently.

## Consequences

- The function is small and fully unit-tested, including the rounding boundary.
- Fee rules (delivery, service fee, VAT rate) are inputs, so they can be versioned and
  stored with each order in step 3.
- The current VAT rate and flat service fee are demo values, not legal advice.
