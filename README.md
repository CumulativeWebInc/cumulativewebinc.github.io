# Cumulative Web Inc — Label Platform (build)

Single data-driven static app. Hash routing, vanilla JS, zero dependencies,
system fonts, $0. Design: `../design/` (DESIGN-SYSTEM.md, tokens.css,
components.html, PLAYER-CHROME.md — followed verbatim).

## Routes

| Hash | View |
|------|------|
| `#/` | home — label hero, roster, now streaming, software + storefront highlights |
| `#/artists` | full roster grid |
| `#/artist/<slug>` | artist detail (bio, releases, tracks, links, merch, booking) |
| `#/producer` | Black Lansky's producer page + credits table |
| `#/music` | catalog, podcast, Artist Services packs, THE EDIT storefront, Call Sheet |
| `#/clothing` | CWI Apparel — DROPPING SOON waitlist |
| `#/software` | THE EDIT, Agent Deck, x402, Caravan, KingCode Lens |

Unknown routes and unknown artist slugs render an in-app "Not found" view.

## How to add an artist (one JSON, no code changes)

1. Create `data/artists/<new-slug>.json` following `../data/SCHEMA.md`
   (`name`, `slug`, `role`, `tagline`, `bio`, `status`, `image`, `genres?`,
   `releases?`, `tracks[]` — `spotify_track_id` only when verified,
   `links` only when verified, `merch`, `booking_cta`, `copyright`).
   Validate: `python3 -m json.tool data/artists/<new-slug>.json`.
2. Drop art at `assets/artists/<new-slug>.jpg` and set `image` to that path —
   or leave `"image": "placeholder"` for the monogram/gradient placeholder.
3. Add `<new-slug>` to `data/roster.json` `order` at the desired position.
4. Reload the site. The router discovers the file from `roster.json`.

Honesty rules (hard): no `spotify_track_id` without a verified ID — the
player chrome only renders real `open.spotify.com/embed` iframes where IDs
are verified; everything else gets the labeled placeholder. Statuses
LIVE/SAMPLE/DRAFT/PLANNED/NEW are badges asserting facts, never decoration.

## How to update commerce

`data/commerce.json` is the commerce source of truth. Every offer, price, and
URL in it must come from a verified live page (see LINKS.md). To update:

1. Re-extract from the live source (hub / cwi-edit / cwi-store).
2. Edit `data/commerce.json`, validate with `python3 -m json.tool`.
3. Curl-verify every outbound URL in it returns HTTP 200; update LINKS.md.

Never invent prices, releases, stream counts, inventory, or URLs.

## Verification

- `tools/verify-routes.js` — node harness: renders every route against stubbed
  DOM/fetch, asserts markers, link allowlist (must be in LINKS.md's 200 set),
  valid internal hashes, no nested `<a>`, no `javascript:` hrefs.
  Run: `node tools/verify-routes.js` (needs the `data/` tree next to it).
- Browser suite (used for the 2026-09-23 build): Playwright + meta-chromium
  over `file://` — every route at 1440px and 360px, zero horizontal scroll
  (`scrollWidth <= innerWidth`), player close/reopen, screenshots.

## Deploy

Push the contents of this `build/` directory to the root of
`CumulativeWebInc/cumulativewebinc.github.io` via `ghapi_put_file`
(file arg, never inline `--data`). Do NOT touch DNS, CNAME, or the live repo
from this build — the coordinator pushes after independent verification.

© 2026 Cumulative Web Inc
