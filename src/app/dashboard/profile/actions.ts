'use server';

import type { ActionResult } from '@/lib/action-result';
import { patchVendorProfile } from '@/lib/merqo-vendor-profile';
import {
  profileNameSchema,
  socialLinksSchema,
  type ProfileNameInput,
  type SocialLinksInput,
} from '@/lib/schemas';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Update the vendor's shared stall name. Persisted in merqo.vendor_profile
 * (shared across every kit — docs/business/2026-07-21-profile-settings-page-standard.md)
 * via the patch_vendor_profile RPC — the source of truth — then mirrored
 * into stockkit's local vendors.name so the dashboard nav (which reads only
 * the local column) reflects the new name right away.
 */
export async function updateStallName(input: ProfileNameInput): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid stall name',
    };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in' };

  try {
    await patchVendorProfile(supabase, user.id, { stallName: parsed.data.name });
  } catch (err) {
    console.error('updateStallName failed', err instanceof Error ? err.message : err);
    return { success: false, error: 'Could not save stall name' };
  }

  // Secondary sync-write: keep the local vendors.name display cache in step
  // with the shared merqo.vendor_profile row (the source of truth, written
  // above) so the dashboard nav's read path — vendors.name, unchanged — shows
  // the new name immediately. The shared write already succeeded, so a
  // failure here is logged but not surfaced as an error to the vendor.
  try {
    const { error: localSyncError } = await supabase
      .from('vendors')
      .update({ name: parsed.data.name })
      .eq('id', user.id);
    if (localSyncError) {
      console.error('updateStallName local sync failed', localSyncError.message);
    }
  } catch {
    console.error('updateStallName local sync rejected');
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true };
}

/** Update the vendor's profile-level social links. Same write path as updateStallName. */
export async function updateSocialLinks(input: SocialLinksInput): Promise<ActionResult> {
  const parsed = socialLinksSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid links',
    };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in' };

  try {
    await patchVendorProfile(supabase, user.id, { socialLinks: parsed.data });
  } catch (err) {
    console.error('updateSocialLinks failed', err instanceof Error ? err.message : err);
    return { success: false, error: 'Could not save links' };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true };
}
