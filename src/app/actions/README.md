# actions

## Purpose

Server actions shared across routes rather than colocated with a single page — vendor NPS feedback and Get-help support messages, both filed into the shared cross-kit `merqo` schema.

## Contents

- `feedback.ts` — `submitFeedbackAction(input: FeedbackInput): Promise<ActionResult>`. Validates with `feedbackSchema`, requires a signed-in vendor, then inserts via `submitVendorFeedback` (`@/lib/merqo-vendor-feedback`) which calls the shared `merqo.submit_vendor_feedback` SECURITY DEFINER RPC — the RPC derives `vendor_id` from `auth.uid()` itself, never a passed-in value.
- `feedback.test.ts` — covers the signed-in RPC-call path, schema rejection, the "please sign in" path, and RPC-failure handling.
- `support.ts` — `submitSupportMessageAction(input: unknown): Promise<ActionResult>`. Validates with `supportMessageSchema`, requires a signed-in vendor, then files the message via `submitSupportMessage` (`@/lib/merqo-support`) into the shared `merqo.support_messages` inbox through `merqo.submit_support_message` (SECURITY DEFINER). Inline session check, not a shared vendor-auth guard — backs a Sheet-embedded widget off the dashboard nav, not a full page.
- `support.test.ts` — covers the signed-in RPC-call path, schema rejection, the "please sign in" path, and RPC-failure handling.
- `plan.ts` — `requestProUpgradeAction(): Promise<ActionResult>`. No input to validate (fixed request body) — requires a signed-in vendor, then files a `category: 'billing'` message via the same `submitSupportMessage` helper `support.ts` uses. stockkit has no self-serve billing yet; Pro is granted manually once the request lands in the shared inbox. Mirrors paykit's identical `src/app/actions/plan.ts`.
- `plan.test.ts` — covers the signed-in RPC-call path, the "please sign in" path, and RPC-failure handling.

## Connectivity

Each file is a `"use server"` module imported directly by the client component that triggers it: `feedback.ts` by `src/components/feedback-form.tsx` (also referenced from `dashboard-nav.dom.test.tsx`), `support.ts` by `src/components/support-form.tsx`, `plan.ts` by `src/app/dashboard/plan/upgrade-cta.tsx`. All three go through the RLS-scoped `createServerClient()` — no service-role usage, since the target RPCs are SECURITY DEFINER and derive the vendor identity themselves.

## Parent

[app](../README.md)
