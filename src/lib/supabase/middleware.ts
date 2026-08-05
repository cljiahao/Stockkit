import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { publicEnv } from '@/lib/supabase/env';
import type { Database } from '@/lib/types';

// /dashboard and /admin both need a session — everything else (the landing
// page, the login page) is public. /admin's own authorization is enforced
// independently by requireAdmin() in src/app/admin/layout.tsx (a Server
// Component, which can't write cookies), so routing it through here too is
// what gives an /admin visit the same session-refresh/cookie-write treatment
// a /dashboard visit gets from this function's setAll.
function isProtectedPath(path: string): boolean {
  return path.startsWith('/dashboard') || path.startsWith('/admin');
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database, 'stockkit'>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      db: { schema: 'stockkit' },
    }
  );

  // Public routes are hot — don't spend an auth round-trip (or risk an auth-
  // outage 500) on them. Only protected routes resolve the user.
  if (!isProtectedPath(request.nextUrl.pathname)) return supabaseResponse;

  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth unreachable — degrade to "unauthenticated" and redirect to /login
    // rather than 500-ing a protected route.
    user = null;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
