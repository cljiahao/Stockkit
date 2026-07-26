# Shared document/photo import (invoice & receipt scanning) — roadmap note

Status: **deferred, not scheduled for implementation.** This is a forward-looking
roadmap note, not a spec ready for `writing-plans` — it exists so the decision
and its reasoning are recorded, not lost, and so a future session doesn't
re-litigate the same ground from scratch.

## Problem

Restocking today means a vendor manually typing each line item from a
supplier invoice or delivery note into stockkit's product/stock-log forms.
Many inventory tools in this space (Zoho Inventory, inFlow, Sortly — see the
earlier product survey in this conversation) offer photo/OCR-based invoice
import to cut that manual entry down. It's a real, validated pattern in the
category — not a speculative idea.

## Why deferred (not "no," just "not now")

1. **Nothing to feed yet.** OCR-extracted line items need a batch-entry
   destination — the stock-take/cycle-count session
   (`2026-07-26-stock-take-cycle-count-design.md`) or the raw-material
   restock flow (`2026-07-26-raw-material-finished-good-linking-design.md`)
   are the natural landing points, and neither is built yet. Building the
   scanner before its destination exists means building UI polish on top of
   nothing.
2. **Cost-model risk.** Vision/OCR API calls are usage-metered and their
   pricing is inconsistent across providers and over time — a real concern
   for a v1 tool aimed at cost-sensitive home/small vendors, and one the
   project owner raised directly. stockkit's current stack has zero AI/LLM
   dependency (confirmed: no AI/OCR usage exists anywhere in the `merqo`
   monorepo today — checked `merqo`/`qkit`/`paykit`/`loopkit`, nothing).
   Adding one changes the cost model for the whole product, not just this
   feature.
3. **It isn't stockkit-specific.** qkit (menu/booth items) would plausibly
   want the same "import from a photo" capability for menu setup. Building
   it once, bespoke, inside stockkit would mean qkit re-builds the same
   thing later — duplicated cost and two inconsistent implementations of the
   same idea.

## If/when this gets built

- **Shape: a shared `merqo`-level capability**, not a stockkit-owned
  feature — parallel to how `merqo.vendor_profile`/`vendor_feedback`/
  `support_message` are already shared across kits. Each kit (stockkit,
  qkit, ...) would call it over HTTP+bearer-secret, per the project-wide
  cross-kit convention (never a direct cross-schema query) — the same
  pattern confirmed for the qkit sales-sync integration point.
- **Cost model: bring-your-own-key (BYOK).** The vendor supplies their own
  vision-API key; stockkit/merqo never eats the per-call cost or bears
  pricing-volatility risk on the vendor's behalf. This keeps the feature
  optional and keeps its cost fully opt-in.
- **Trigger for revisiting:** once the stock-take session and raw-material
  restock flows are built and in real use, and if manual line-item entry is
  a vendor's most commonly voiced complaint (not assumed — actually heard),
  this becomes worth spec'ing properly as its own cross-repo project
  (touches `merqo`, stockkit, and potentially qkit — bigger than a single-kit
  spec, would need its own decomposition the way this session's original
  sweep did).

## Explicitly out of scope for this note

No schema, no API contract, no vendor-facing UI decisions — those belong in
a real spec once this is actually greenlit. This note only records the
decision to defer, the reasoning, and the shape it should take later.

## Interactions with sibling specs

- `2026-07-26-stock-take-cycle-count-design.md` and
  `2026-07-26-raw-material-finished-good-linking-design.md` — the two
  natural consumers of scanned line-item data, once built.
- Cross-kit qkit sales-sync (referenced in this session's research, not yet
  spec'd) — same HTTP+bearer-secret shape would likely apply to this
  capability too.
