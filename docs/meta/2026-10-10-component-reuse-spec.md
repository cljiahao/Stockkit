# Stockkit component reuse cleanup

## Confirmed scope

Centralize the three stock-reason label maps using StockMovementReason while retaining initial-balance display and only three user-selectable reasons. Remove unused STOCK_STATUS_TEXT_CLASS. Supply Next Link to shared BackButton on plan/profile pages. Extract controlled local PasswordFields for profile/recovery, preserving IDs, styling, autocomplete and distinct authorization/save/navigation flows while linking recovery validation feedback accessibly. Correct adjacent README/comment drift.

## Boundaries and decisions

Keep monetary input behavior and responsive product components. Preserve public health URLs. CSV export is already an authorized tested action advertised by the plan: confirm the missing UI and expose it through the product workspace rather than deleting the capability or changing entitlement policy. Tour example HTML must use canonical indicator tokens without importing react-dom/server in production. Next.js rejects legacy server rendering from Server Components; a regression compares the constant serialized example to the actual indicator markup. No database/harness changes or cosmetic folder migration.

## Acceptance

Reason labels/fallbacks and stock movement mutations unchanged. Password labels and error descriptions remain unique/accessible, no session-policy merging. Client navigation uses Next Link. CSV download uses authenticated action and existing Pro policy. Tour markup remains trusted constant HTML. Meaningful affected tests, full check/coverage >=80% all four metrics and redacted security checks pass; independent diff review plus required green CI precedes merge.
