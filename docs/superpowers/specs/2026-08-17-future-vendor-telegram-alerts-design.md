# Future: Vendor Telegram Alerts — Design Notes

**Date:** 2026-08-17
**Status:** Draft — deferred, no go-ahead. Not a scoped spec, a placeholder
capturing the idea and what's already reusable, so a future discussion
doesn't start from zero.

## Why stockkit doesn't have this yet

qkit (order placed) and loopkit (reward redeemed) both shipped a vendor
Telegram alert for a real-time customer-driven event — see
`Merqo Business/docs/business/2026-08-16-telegram-integration-design.md`.
stockkit has no equivalent customer-driven event at all (it's a solo
inventory ledger, not a customer-facing kit) — this was never scoped into
Phase A, not an oversight.

## The one real candidate, if this gets picked up

**Low-stock / out-of-stock threshold crossed.** stockkit already computes
this in-app (`src/lib/stock.ts`'s ok/low/out classification, surfaced on
the dashboard today) — a Telegram push would just be an alternate channel
for a signal that already exists, not a new detection to build. Already
named as a speculative future direction in
`Merqo Business/docs/business/2026-08-16-portfolio-roadmap-discussion.md`'s
per-kit roadmap section, alongside reorder-point suggestions — unconfirmed
against real vendor need, same caution applies here.

**Open question if this moves forward:** unlike qkit's/loopkit's
single-event triggers (one order, one redemption), a stock threshold is a
_level_, not a discrete event — needs a debounce/cooldown decision (don't
re-alert on every single sale once a product is already below threshold)
that qkit's/loopkit's existing patterns don't have an answer for. Worth
resolving before building, not during.

## What's already reusable, if approved

merqo now owns the one shared vendor-alert bot (Phase A2,
`merqo/docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md`).
A vendor who's already connected via merqo's profile page (for qkit or
loopkit alerts) needs **zero new connect flow** — stockkit would only
need to call merqo's existing `POST /api/merqo/notify-vendor` with
`{ vendor_id, message }` from wherever the stock-level check runs, same
`MERQO_CUSTOMER_SECRET` bearer pattern every other kit already uses. This
is a small addition once the debounce question above is resolved, not a
new architecture.

## Parent

[specs](README.md)
