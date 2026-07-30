'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { resizeToWebp } from '@/lib/image-resize';
import { createClient } from '@/lib/supabase/client';

// SVG is intentionally excluded — an avatar is always a real photo/raster upload.
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
// Server bucket limit is 5MB; resizeToWebp re-encodes to WebP to stay under
// this, but the fallback path (decode/encode failure) uploads original.
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1000;

interface Props {
  vendorId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

// Square avatar-only uploader for the profile page's "Profile icon" section
// (docs/business/2026-07-21-profile-settings-page-standard.md §2.4) — no
// banner variant, stockkit has no booth/product-photo use case.
export function ImageUploader({ vendorId, value, onChange }: Props) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Use a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be 5 MB or smaller');
      return;
    }

    setUploading(true);
    try {
      const { blob, ext, type } = await resizeToWebp(file, MAX_DIM);
      const path = `${vendorId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('vendor-avatars')
        .upload(path, blob, { upsert: false, contentType: type });

      if (error) {
        toast.error('Upload failed');
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('vendor-avatars').getPublicUrl(path);
      onChange(publicUrl);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div className="border-border relative size-20 shrink-0 overflow-hidden rounded-xl border">
        <Image src={value} alt="" fill sizes="5rem" className="object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="bg-background/90 text-foreground hover:bg-background absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full shadow-sm backdrop-blur"
          aria-label="Remove image"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground flex size-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed transition-colors disabled:opacity-60"
    >
      {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      <span className="text-[10px] leading-tight font-medium">{uploading ? '…' : 'Add photo'}</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </button>
  );
}
