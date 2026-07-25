'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ElevatedCard } from '@/components/elevated-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandText } from '@/components/widgets';
import { navigatingAway, useAsyncAction } from '@/hooks';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { loginSchema, vendorSchema, type LoginInput } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from '@/lib/utils';

import { completeSignup } from './actions';

type Mode = 'signin' | 'signup';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[1.05rem]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [stallName, setStallName] = useState('');
  const [stallNameError, setStallNameError] = useState<string | null>(null);
  const { pending: loading, run } = useAsyncAction();
  const [sent, setSent] = useState<{ email: string; kind: 'signup' | 'reset' } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  function signInWithGoogle() {
    return run(async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) toast.error(error.message);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function onSubmit(data: LoginInput) {
    if (mode === 'signup') {
      const parsedName = vendorSchema.safeParse({ name: stallName });
      if (!parsedName.success) {
        setStallNameError(parsedName.error.issues[0]?.message ?? 'Enter your stall name');
        return;
      }
    }
    setStallNameError(null);

    return run(async () => {
      try {
        if (mode === 'signup') {
          // Land the confirmation-email link back on stockkit — the shared
          // Supabase project's Site URL may point at another kit, so without
          // this the confirm link would bounce the vendor to the wrong app.
          const { data: result, error } = await supabase.auth.signUp({
            ...data,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });
          if (error) {
            toast.error(error.message);
            return;
          }
          if (!result.session) {
            setSent({ email: data.email, kind: 'signup' });
            return;
          }
          const signupResult = await completeSignup(stallName);
          if (!signupResult.success) toast.error(signupResult.error);
          router.push(PAGE_ROUTES.DASHBOARD);
          router.refresh();
          await navigatingAway();
          return;
        }

        const { error } = await supabase.auth.signInWithPassword(data);
        if (error) {
          toast.error(error.message);
          return;
        }
        router.push(PAGE_ROUTES.DASHBOARD);
        router.refresh();
        await navigatingAway();
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function sendReset() {
    const email = getValues('email');
    const parsed = loginSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      toast.error('Enter your email first');
      return;
    }
    return run(async () => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=${PAGE_ROUTES.RESET_PASSWORD}`,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        setSent({ email, kind: 'reset' });
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  const isSignin = mode === 'signin';

  if (sent) {
    const isReset = sent.kind === 'reset';
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <div className="w-full max-w-md text-center">
          <ElevatedCard className="px-7 py-10">
            <Link href={PAGE_ROUTES.HOME} className="text-2xl font-bold tracking-tight">
              <BrandText />
            </Link>
            <h1 className="mt-6 text-3xl leading-tight font-semibold">Check your email</h1>
            <p className="text-muted-foreground mt-3 text-sm">
              {isReset ? (
                <>
                  We sent a password reset link to{' '}
                  <span className="text-foreground font-medium">{sent.email}</span>. Open it to
                  choose a new password.
                </>
              ) : (
                <>
                  We sent a confirmation link to{' '}
                  <span className="text-foreground font-medium">{sent.email}</span>. Click it to
                  activate your account, then sign in.
                </>
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-7 w-full rounded-xl"
              onClick={() => {
                setSent(null);
                setMode('signin');
              }}
            >
              Back to sign in
            </Button>
          </ElevatedCard>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href={PAGE_ROUTES.HOME} className="text-4xl font-bold tracking-tight">
            <BrandText />
          </Link>
          <p className="text-muted-foreground mt-1 text-sm">
            Track stock in and out, and know your costs.
          </p>
        </div>

        <ElevatedCard>
          <div className="px-7 pt-9 pb-8">
            <h1 className="text-3xl leading-tight font-semibold">
              {isSignin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {isSignin
                ? 'Sign in to your vendor dashboard.'
                : 'Set up a vendor account in seconds.'}
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={signInWithGoogle}
              disabled={loading}
              className="mt-7 h-12 w-full gap-2.5 rounded-xl text-[0.95rem] font-medium"
            >
              <GoogleMark />
              Continue with Google
            </Button>

            <div className="my-6 flex items-center gap-3">
              <span className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
                or with email
              </span>
              <span className="bg-border h-px flex-1" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="stallName" className={FORM_LABEL_CLASS}>
                    Stall / business name
                  </Label>
                  <Input
                    id="stallName"
                    value={stallName}
                    onChange={(e) => setStallName(e.target.value)}
                    placeholder="Mama's Kitchen"
                    className="h-11 rounded-xl"
                    aria-invalid={!!stallNameError}
                    aria-describedby={stallNameError ? 'stallName-error' : undefined}
                  />
                  {stallNameError && (
                    <p id="stallName-error" role="alert" className={FORM_ERROR_CLASS}>
                      {stallNameError}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className={FORM_LABEL_CLASS}>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="h-11 rounded-xl"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="email-error" role="alert" className={FORM_ERROR_CLASS}>
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className={FORM_LABEL_CLASS}>
                    Password
                  </Label>
                  {isSignin && (
                    <button
                      type="button"
                      onClick={sendReset}
                      disabled={loading}
                      className="text-primary text-xs font-semibold underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-11 rounded-xl"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                {errors.password && (
                  <p id="password-error" role="alert" className={FORM_ERROR_CLASS}>
                    {errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full rounded-xl text-base font-semibold"
                disabled={loading}
              >
                {loading ? 'Please wait…' : isSignin ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          </div>

          <div className="border-t" />
          <p className="text-muted-foreground px-7 py-4 text-center text-sm">
            {isSignin ? 'New to stockkit? ' : 'Already have an account? '}
            <button
              type="button"
              className="text-primary ml-1 font-semibold underline-offset-4 hover:underline"
              onClick={() => setMode(isSignin ? 'signup' : 'signin')}
            >
              {isSignin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </ElevatedCard>
      </div>
    </main>
  );
}
