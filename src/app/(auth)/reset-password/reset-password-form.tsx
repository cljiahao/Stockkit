'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ElevatedCard } from '@/components/elevated-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { navigatingAway, useAsyncAction } from '@/hooks';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { passwordChangeSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from '@/lib/utils';

type SessionState = 'checking' | 'ready' | 'no-session';

// Sets a new password on the recovery session established by /auth/callback
// (the reset link exchanges its code there, then forwards here). If no
// session is present the link was already used or expired, so this routes
// the vendor back to sign in rather than showing a form that would fail.
export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setState(data.user ? 'ready' : 'no-session');
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  function submit() {
    const parsed = passwordChangeSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your password');
      return;
    }
    setError(null);
    return run(async () => {
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          password: parsed.data.password,
        });
        if (updateError) {
          toast.error(updateError.message);
          return;
        }
        toast.success('Password updated');
        router.push(PAGE_ROUTES.DASHBOARD);
        router.refresh();
        await navigatingAway();
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  if (state === 'checking') {
    return (
      <ElevatedCard className="px-7 py-8">
        <p className="text-muted-foreground text-center text-sm">Checking your reset link…</p>
      </ElevatedCard>
    );
  }

  if (state === 'no-session') {
    return (
      <ElevatedCard className="px-7 py-8">
        <h1 className="text-2xl leading-tight font-semibold">This link has expired</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Password reset links can only be used once, and they expire after a short while. Request a
          fresh one from the sign-in page.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
          <Link href={PAGE_ROUTES.LOGIN}>Back to sign in</Link>
        </Button>
      </ElevatedCard>
    );
  }

  return (
    <ElevatedCard className="px-7 py-8">
      <h1 className="text-2xl leading-tight font-semibold">Set a new password</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Pick something at least 8 characters long.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-6 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-11 rounded-xl"
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
            className="h-11 rounded-xl"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && (
            <p role="alert" className={FORM_ERROR_CLASS}>
              {error}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={pending || !password || !confirm}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </ElevatedCard>
  );
}
