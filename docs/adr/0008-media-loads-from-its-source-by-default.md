# 8. Media loads from its source by default

Date: 2026-10-11
Status: accepted

## Context

Decision 7 kept photographs and film out of the repository and downloaded them with a
command. In practice a fresh clone showed colour blocks where every cover and dish
should be, and no film, until that command had been run. A food delivery site with no
pictures of food does not show what the project is. The download command also depended
on one address format working for 190 files, which could not be guaranteed.

Committing the files was the other option. It would add tens of megabytes of other
people's photographs to the repository and its history.

## Decision

- `apps/web/src/media/library.json` is committed, filled with the remote address of
  every photograph and clip in the manifest. The site shows media on first run.
- Photographs are requested from Unsplash's image servers at the width the page needs
  (`?auto=format&w=…`), which those servers are built to do, and do not pass through
  the Next.js image optimiser. The clips load from Mixkit and Pexels.
- A copy under `apps/web/public/media` always wins. `pnpm media:fetch` makes those
  copies; `pnpm media:library` rebuilds the list; `pnpm media:check` reports addresses
  that no longer answer.
- Every kitchen has a cover and a profile picture and every dish has a photograph. The
  assignments live in one file, `apps/api/src/seed/photos.ts`, and tests fail if a dish
  or kitchen is left without one, or if the manifest lists a picture nothing uses.
- A picture that fails to load is replaced in the browser by the fallback from
  decision 7. A film clip that fails is dropped from the sequence.
- The film's clips are only requested when they can play or be shown as a still. A
  visitor who has asked their browser to save data gets the ember scene and a play
  button instead.

## Consequences

- This is an exception to decision 3, which keeps third-party requests off the page:
  the browser now contacts Unsplash, Mixkit and Pexels. Running `pnpm media:fetch`
  before deploying removes those requests again.
- The site depends on those addresses staying up. `pnpm media:check` finds the ones
  that have gone; the fallbacks cover the time in between.
- Without a connection the site shows its fallbacks, as it did before.
- The photographs are stand-ins for invented kitchens. The credits page says so.
