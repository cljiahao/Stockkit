'use client';

import { ImageUploader } from '@/components/image-uploader';
import { Section } from '@/components/section';
import { SocialLinksFields } from '@/components/social-links-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAsyncAction } from '@/hooks';
import {
  displayNameSchema,
  passwordChangeSchema,
  profileNameSchema,
  socialLinksSchema,
  type SocialLinksInput,
} from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from '@/lib/utils';
import { IdCard, KeyRound, Share2, Store, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { updateSocialLinks, updateStallName } from './actions';

interface Props {
  vendorId: string;
  stallName: string;
  socialLinks: SocialLinksInput;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export function ProfileForm({
  vendorId,
  stallName,
  socialLinks,
  displayName,
  email,
  avatarUrl,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(stallName);
  const [nameError, setNameError] = useState<string | null>(null);
  const { pending: savingName, run: runName } = useAsyncAction();

  const [links, setLinks] = useState(socialLinks);
  const [linksError, setLinksError] = useState<string | null>(null);
  const { pending: savingLinks, run: runLinks } = useAsyncAction();

  const [avatar, setAvatar] = useState(avatarUrl);
  const { run: runAvatar } = useAsyncAction();

  const [display, setDisplay] = useState(displayName);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const { pending: savingDisplay, run: runDisplay } = useAsyncAction();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const { pending: savingPw, run: runPw } = useAsyncAction();

  function saveName() {
    const parsed = profileNameSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Invalid stall name');
      return;
    }
    setNameError(null);
    return runName(async () => {
      try {
        const res = await updateStallName(parsed.data);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success('Stall name saved');
        router.refresh();
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function saveLinks() {
    const parsed = socialLinksSchema.safeParse(links);
    if (!parsed.success) {
      setLinksError(parsed.error.issues[0]?.message ?? 'Invalid links');
      return;
    }
    setLinksError(null);
    return runLinks(async () => {
      try {
        const res = await updateSocialLinks(parsed.data);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success('Links saved');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function saveAvatar(url: string | null) {
    const previousAvatar = avatar;
    setAvatar(url);
    return runAvatar(async () => {
      try {
        const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
        if (error) {
          setAvatar(previousAvatar);
          toast.error(error.message);
          return;
        }
        toast.success(url ? 'Profile icon saved' : 'Profile icon removed');
        router.refresh();
      } catch {
        setAvatar(previousAvatar);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function saveDisplayName() {
    const parsed = displayNameSchema.safeParse({ displayName: display });
    if (!parsed.success) {
      setDisplayError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    setDisplayError(null);
    return runDisplay(async () => {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { display_name: parsed.data.displayName },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Display name saved');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function savePassword() {
    const parsed = passwordChangeSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? 'Check your password');
      return;
    }
    setPwError(null);
    return runPw(async () => {
      try {
        const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Password updated');
        setPassword('');
        setConfirm('');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start">
      <div className="flex flex-1 flex-col gap-5">
        <Section
          icon={<Store className="size-5" />}
          eyebrow="Shown to customers"
          title="Stall/shop name"
          description="The name vendors and Merqo kits see for your business."
        >
          <div className="space-y-2">
            <Label htmlFor="stall-name" className={FORM_LABEL_CLASS}>
              Stall/shop name
            </Label>
            <Input
              id="stall-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'stall-name-error' : undefined}
            />
            {nameError && (
              <p id="stall-name-error" className={FORM_ERROR_CLASS}>
                {nameError}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveName} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Section>

        <Section
          icon={<UserRound className="size-5" />}
          eyebrow="Your account menu"
          title="Profile icon"
          description="A small image for your account menu. Defaults to your initials."
        >
          <div className="flex items-center gap-4">
            <ImageUploader vendorId={vendorId} value={avatar} onChange={saveAvatar} />
            <p className="text-muted-foreground text-xs">
              Square images look best. Remove it any time to fall back to your initials badge.
            </p>
          </div>
        </Section>

        <Section
          icon={<KeyRound className="size-5" />}
          eyebrow="Sign-in security"
          title="Change password"
          description="Set a new password. At least 8 characters."
        >
          <div className="space-y-2">
            <Label htmlFor="account-email" className={FORM_LABEL_CLASS}>
              Email
            </Label>
            <Input id="account-email" value={email} readOnly disabled className="bg-secondary/60" />
            <p className="text-muted-foreground text-xs">
              Your sign-in email. It can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className={FORM_LABEL_CLASS}>
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!pwError}
              aria-describedby={pwError ? 'confirm-password-error' : undefined}
            />
            {pwError && (
              <p id="confirm-password-error" className={FORM_ERROR_CLASS}>
                {pwError}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={savePassword} disabled={savingPw || !password || !confirm}>
              {savingPw ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </Section>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        <Section
          icon={<IdCard className="size-5" />}
          eyebrow="Just for you"
          title="Display name"
          description="How stockkit addresses you. Customers never see this."
        >
          <div className="space-y-2">
            <Label htmlFor="display-name" className={FORM_LABEL_CLASS}>
              Display name
            </Label>
            <Input
              id="display-name"
              value={display}
              placeholder="e.g. Aisha"
              onChange={(e) => setDisplay(e.target.value)}
              aria-invalid={!!displayError}
              aria-describedby={displayError ? 'display-name-error' : undefined}
            />
            {displayError && (
              <p id="display-name-error" className={FORM_ERROR_CLASS}>
                {displayError}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={saveDisplayName}
              disabled={savingDisplay}
              aria-label="Save display name"
            >
              {savingDisplay ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Section>

        <Section
          icon={<Share2 className="size-5" />}
          eyebrow="Shown to customers"
          title="Social links"
          description="Applies across every Merqo kit you use."
        >
          <SocialLinksFields value={links} onChange={setLinks} idPrefix="profile" />
          {linksError && <p className={FORM_ERROR_CLASS}>{linksError}</p>}
          <div className="flex justify-end">
            <Button onClick={saveLinks} disabled={savingLinks} aria-label="Save links">
              {savingLinks ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
