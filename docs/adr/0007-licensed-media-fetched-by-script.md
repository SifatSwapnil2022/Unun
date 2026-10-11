# 7. Photographs and film come from a manifest, and the site works without them

Date: 2026-10-11
Status: amended by decision 8

## Context

A food site needs photographs. Copying images from real delivery platforms or
restaurants would infringe their rights. Hot-linking stock images at run time adds
third-party requests, which decision 3 avoids, and breaks when a remote file moves.

## Decision

- `media/manifest.json` lists every photograph and clip: where it comes from, who made
  it, what it shows and what the site uses it for. Sources are limited to libraries
  whose licences allow free use (Unsplash, Pexels, Mixkit).
- `pnpm media:fetch` downloads the files into `apps/web/public/media` and writes
  `library.json`, the only media file the web app reads.
- Every place that shows media has a designed fallback: a flat colour block with a name
  for a photograph, the ember scene for the film.
- The `/credits` page credits every author, although the licences do not require it.

## Consequences

- The repository can be cloned and run with no media at all.
- A photograph that does not suit its dish is replaced by changing one line.
- Stock photographs are not always of Bangladeshi food. Photographs taken for the
  project should replace them over time; the manifest accepts files with source `own`.

## What changed

The first version showed no media until `pnpm media:fetch` had been run, so a fresh
clone looked empty. Decision 8 changes the default. The manifest, the fallbacks and the
credits page stay as described here.
