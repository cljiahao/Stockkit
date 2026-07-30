'use client';

import { SOCIAL_LINK_FIELDS } from '@/components/social-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SocialLinksInput } from '@/lib/schemas';
import { FORM_LABEL_CLASS } from '@/lib/utils';

const PLACEHOLDERS: Record<keyof SocialLinksInput, string> = {
  website: 'https://your-stall.com',
  instagram: 'https://instagram.com/yourstall',
  facebook: 'https://facebook.com/yourstall',
  tiktok: 'https://tiktok.com/@yourstall',
};

interface Props {
  value: SocialLinksInput;
  onChange: (next: SocialLinksInput) => void;
  idPrefix: string;
}

export function SocialLinksFields({ value, onChange, idPrefix }: Props) {
  function setField(key: keyof SocialLinksInput, raw: string) {
    onChange({ ...value, [key]: raw });
  }

  return (
    <div className="space-y-4">
      {SOCIAL_LINK_FIELDS.map(({ key, label, icon: Icon }) => {
        const id = `${idPrefix}-${key}`;
        return (
          <div key={key} className="space-y-2">
            <Label htmlFor={id} className={FORM_LABEL_CLASS}>
              <span className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {label}
              </span>
            </Label>
            <Input
              id={id}
              value={value[key] ?? ''}
              placeholder={PLACEHOLDERS[key]}
              onChange={(e) => setField(key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
