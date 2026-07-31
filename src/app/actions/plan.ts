'use server';

import type { ActionResult } from '@/lib/action-result';
import { submitSupportMessage } from '@/lib/merqo-support';
import { createServerClient } from '@/lib/supabase/server';

/**
 * "Ask us to upgrade to Pro" CTA on the plan page. stockkit has no
 * self-serve billing yet — this files the request through the same
 * merqo.submit_support_message mechanism the account-menu "Get help"
 * flow already uses (category "billing"), mirroring paykit's identical
 * pattern (src/app/actions/plan.ts there).
 */
export async function requestProUpgradeAction(): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Please sign in first' };

  try {
    await submitSupportMessage(supabase, 'billing', 'Requesting an upgrade to the Pro plan.');
  } catch (err) {
    console.error('requestProUpgradeAction failed', err instanceof Error ? err.message : err);
    return { success: false, error: 'Could not send your request' };
  }
  return { success: true };
}
