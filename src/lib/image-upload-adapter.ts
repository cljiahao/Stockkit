import type { ImageUploadPayload } from '@merqo/ui';

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
