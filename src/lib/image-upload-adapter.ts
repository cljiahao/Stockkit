import { storagePathFromPublicUrl, type ImageUploadPayload } from '@merqo/ui';

import { createClient } from '@/lib/supabase/client';

/**
 * `@merqo/ui`'s `ImageUploader.onUpload` adapter for the profile page's
 * avatar uploader — performs the actual `vendor-avatars` Storage bucket
 * write and resolves the resulting public URL. Ported from the pre-migration
 * `image-uploader.tsx`'s `handleFile` upload step. Throws (never returns a
 * result object) on failure, per the package's contract.
 */
export async function uploadVendorAvatar({
  bucket,
  path,
  blob,
  contentType,
}: ImageUploadPayload): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: false, contentType });
  if (error) {
    throw new Error('Upload failed');
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

// Every public bucket a vendor's avatar can live in. All five Merqo apps share
// one Supabase project and one signed-in user, so `avatar_url` is a single
// field: a vendor may have set it from any app, into that app's bucket.
const AVATAR_BUCKETS = ['booth-images', 'vendor-images', 'vendor-avatars'] as const;

/**
 * Best-effort delete of an avatar image that is no longer referenced — the
 * one just replaced, or a fresh upload whose save failed. Never throws: the
 * avatar change itself has already succeeded or failed by the time this runs,
 * and a leftover object is only wasted storage. Anything that is not a public
 * URL in one of our buckets (a Google profile picture, say) is ignored, and
 * each bucket's owner-folder DELETE policy stops a vendor removing anything
 * but their own objects.
 */
export async function removeReplacedAvatar(url: string | null | undefined): Promise<void> {
  for (const bucket of AVATAR_BUCKETS) {
    const path = storagePathFromPublicUrl(url, bucket);
    if (!path) continue;
    await createClient()
      .storage.from(bucket)
      .remove([path])
      .catch(() => undefined);
    return;
  }
}
