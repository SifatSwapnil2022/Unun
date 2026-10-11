# 9. Sign-in by mobile number and one-time code

Date: 2026-10-11
Status: accepted

## Context

Accounts are needed for order history and saved addresses, and to know who is a
restaurant owner, a rider or an admin. In Bangladesh a mobile number is what people
have and remember; delivery apps there sign people in with a code sent by SMS. A
password would be one more thing to store safely, reset and have reused from other
sites. A rider must be reachable by phone anyway, so the number does two jobs.

## Decision

- A person signs in by entering a mobile number and the six-digit code sent to it.
  The first sign-in with a number creates a customer account.
- A code works once, for five minutes, and stops working after five wrong guesses. A
  number can ask for five codes in ten minutes. Only a hash of the code is stored.
- A session is 32 random bytes in a cookie that scripts cannot read (`HttpOnly`) and
  other sites cannot send with a request that changes anything (`SameSite=Lax`). The
  database stores a hash of the token, so a copy of the database signs nobody in.
- The browser reaches the API through the web app's own address (`/api/*`), so the
  cookie is first-party. Server-rendered pages pass the visitor's cookie on by hand.
- Requests that change something must be JSON. A form on another site cannot send
  that, and the CORS rule stops another site's scripts.
- Each account has one role: customer, owner, rider or admin. The role is read from the
  database on every request, so a change applies to sessions already open. An admin
  changes roles; `ADMIN_PHONE` makes the first admin.
- Orders placed with a number before its holder signed in join the account at sign-in.
- No SMS gateway is connected. `DEMO_LOGIN=1` (the default) hands the code back to the
  page and seeds accounts anyone may use. With `DEMO_LOGIN=0` the code is printed
  where the API runs, and sending it is one injected function.

## Consequences

- There are no passwords to leak, and nothing to reset.
- Whoever holds a phone number holds the account. That is the trade every SMS sign-in
  makes; a second factor for owners and admins is a later step.
- Demo mode is unsafe on purpose and says so when the API starts. It must be off before
  real people sign in.
- Someone without signal cannot sign in. Guest checkout stays, so they can still order.
