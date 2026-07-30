'use server';

import type { ActionResult } from '@/lib/action-result';
import { submitSupportMessage } from '@/lib/merqo-support';
import { supportMessageSchema } from '@/lib/schemas';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Submit a vendor's Get-help message into the shared cross-kit
 * merqo.support_messages inbox via merqo.submit_support_message. Inline
 * session check, not a shared vendor-auth guard — this action backs a
 * Sheet-embedded widget off the dashboard nav, not a full page.
 */
export async function submitSupportMessageAction(input: unknown): Promise<ActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid message',
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Please sign in first' };

  try {
    await submitSupportMessage(supabase, parsed.data.category, parsed.data.body);
  } catch (err) {
    console.error('submitSupportMessageAction failed', err instanceof Error ? err.message : err);
    return { success: false, error: 'Could not send your message' };
  }
  return { success: true };
}
