# 11. Online payment goes through one interface, with a test gateway built in

Date: 2026-10-11
Status: accepted

## Context

Customers in Dhaka expect to pay with bKash or a card as well as cash. Taking real
payments needs a merchant account, which a portfolio project does not have. The usual
shortcut is a fake payment page that looks like the real one. That teaches visitors to
type a PIN into a page that is not bKash, and it is not something to build.

## Decision

- Every way of paying online is a `Gateway` with three operations: start a payment,
  confirm it, and refund it (`apps/api/src/modules/payments/gateways.ts`).
- A **test gateway** is built in. Its payment page is a page of this site, in Unun's
  own design, and says what it is. It asks for no PIN and no card number: the visitor
  presses "Approve" or "Decline". `PAYMENT_SANDBOX=0` turns it off.
- A **bKash gateway** follows bKash's tokenized checkout: grant a token, create the
  payment, send the customer to bKash's own page, and execute the payment when they come
  back. It is used when the four `BKASH_*` settings are present.
- An online order is stored with `awaiting_payment` set and no events. The kitchen is
  told when the payment goes through, and the promised window is counted from that
  moment. An order that is not paid in fifteen minutes lapses.
- Cancelling a paid order refunds it in full, automatically. Support staff can refund
  part of a delivered one.
- A refund is written to the database first and sent to the gateway second. If the
  gateway refuses, the record is marked failed and a person sends the money by hand.
- A cash order is unchanged: the rider collects it.

## Consequences

- No kitchen cooks food that was never paid for, and no customer's money goes back
  without a record of it.
- The bKash code is tested against a stand-in for bKash's servers, including the cases
  where they answer late, twice or not at all. It has not been run against bKash.
- "Card" exists only on the test gateway. A real card gateway would be one more
  implementation of the same interface.
- A customer who closes the payment page finds the order waiting, with a button to pay.
