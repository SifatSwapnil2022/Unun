# 16. An installable site, not a native app

Date: 2026-10-11
Status: accepted

## Context

Most food is ordered from a phone. The project is one person's, and building separate
iOS and Android apps would mean two more codebases, two developer accounts and a Mac.

## Decision

- The site is the app. It has a web manifest, icons drawn from the logo's own path and
  the tags an iPhone needs, so it can be added to the home screen and opens full screen.
- On a narrow screen there is a tab bar at the bottom with four words: home, kitchens,
  the bag, and the place the signed-in person's role starts. The header keeps only the
  logo and the language.
- The layout reads the phone's safe areas, so nothing sits under a notch, a status bar
  or the home indicator. Dialogs rise from the bottom edge.
- A service worker does one thing: when a page cannot be fetched, it shows a page that
  says the phone is offline. It caches no menus, prices or orders, because an old price
  shown as current is worse than none. It is registered in production builds only.
- Pages show a skeleton in their own layout while their data is fetched.

## Consequences

- One codebase serves every screen, and a change reaches phones without a store review.
- There is no listing in the App Store or on Google Play, and no push notification on
  iPhones that have not installed it. Order updates are read from the open page.
- It has been tested in Chromium at phone sizes. Safari on a real iPhone has not been
  run, and is the first thing to check before calling it finished.
