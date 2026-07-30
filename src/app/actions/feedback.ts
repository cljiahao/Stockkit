'use server';
import type { ActionResult } from '@/lib/action-result';
import { submitVendorFeedback } from '@/lib/merqo-vendor-feedback';
import { feedbackSchema, type FeedbackInput } from '@/lib/schemas';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Submit vendor NPS feedback for stockkit into the shared cross-kit
 * merqo.vendor_feedback table via merqo.submit_vendor_feedback — the
 * SECURITY DEFINER function is the authorization boundary (it writes
 * auth.uid() as vendor_id itself, never a passed-in value).
 */
export async function submitFeedbackAction(input: FeedbackInput): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid feedback',
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Please sign in first' };

  try {
    await submitVendorFeedback(supabase, 'stockkit', parsed.data.nps, parsed.data.message ?? null);
  } catch (err) {
    console.error('submitFeedbackAction failed', err instanceof Error ? err.message : err);
    return { success: false, error: 'Could not send feedback' };
  }
  return { success: true };
}
