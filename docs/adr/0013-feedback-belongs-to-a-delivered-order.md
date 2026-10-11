# 13. A rating or a report belongs to a delivered order

Date: 2026-10-11
Status: accepted

## Context

Ratings are only worth reading if they come from people who received the food. Problem
reports need a way to end in money going back, and someone has to decide how much.

## Decision

- A rating is a row tied to one order by a unique index. It can be stored only once
  the order is delivered, for fourteen days, by whoever holds the order's link. A
  kitchen's average is made of those rows and nothing else.
- A reviewer is shown as a first name and one initial. No number or address is shown.
- Support staff can hide a rating. A hidden rating does not count towards the average,
  and its author still sees it on their own order.
- A problem can be reported for two days after delivery, one open report per order and
  three in all. The database allows one open report per order whatever two requests do
  at once.
- Support staff answer a report with a reply and an amount, which may be zero. The
  report is claimed before any money moves, so two admins cannot both refund it, and it
  is opened again if the refund fails.
- A dish's allergens are a list from a fixed set of ten. A customer's "avoid" list is
  kept in their browser and never sent to the server.

## Consequences

- A kitchen cannot be rated by someone who did not order from it, or twice for one
  order.
- A cash order's refund is recorded for staff to send by hand: there is no gateway to
  send it through.
- The seeded allergen lists follow typical recipes. Real kitchens would declare their
  own, which the owner's menu page lets them do.
