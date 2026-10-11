# 3. Two languages from the start, and fonts served from our own origin

Date: 2026-10-11
Status: accepted

## Context

Unun is for Dhaka, where customers read Bangla and English. Adding a second language to a
finished site means touching every component. Web fonts loaded from a third party add a
DNS lookup, a connection and a privacy question.

## Decision

- Every route lives under a locale segment: `/en/...` and `/bn/...`. `/` redirects to `/en`.
- Strings live in typed dictionaries. The Bangla dictionary must match the shape of the
  English one, so a missing translation fails the type check.
- Numbers are formatted with `Intl.NumberFormat`, which gives Bangla digits in `/bn`.
- Fonts are installed from npm (Fontsource) and served with the app.

## Consequences

- Demo data carries both names for every kitchen, cuisine and area.
- Bangla text needs more line height than Latin text, which the base styles handle.
- The Bangla copy was drafted alongside the English and needs a read by a native speaker
  before launch.
