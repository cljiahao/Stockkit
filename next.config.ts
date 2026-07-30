import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      // Local Supabase CLI (`supabase start`) serves Storage from
      // 127.0.0.1:54321 — needed since this project has no hosted Supabase
      // project configured (see AGENTS.md), so local dev is the only way
      // to exercise avatar uploads at all.
      { protocol: 'http', hostname: '127.0.0.1', port: '54321' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },

  async headers() {
    // Client-side Supabase calls (auth, RLS-scoped queries) go straight from
    // the browser to Supabase, so connect-src must allow it. In dev that's
    // local Supabase over plain http/ws (127.0.0.1:54321); in prod it's the
    // hosted *.supabase.co over https/wss.
    const connectSrc =
      process.env.NODE_ENV === 'production'
        ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
        : "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321";

    // Avatars render as plain <img> tags (shadcn's Avatar), so the actual
    // storage/OAuth-picture origins need to be reachable directly — not just
    // same-origin — or the browser silently blocks the request and Avatar
    // falls back to initials as if the photo didn't exist. Google OAuth
    // populates user_metadata.avatar_url with a googleusercontent.com URL
    // before a vendor ever uploads their own, so that origin is needed too.
    const imgSrc =
      process.env.NODE_ENV === 'production'
        ? "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com"
        : "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com http://127.0.0.1:54321";

    // React's dev mode calls eval() to reconstruct stack traces across the
    // RSC boundary — harmless and dev-only, but blocking it spams
    // console.error on every navigation. Production never needs this.
    const scriptSrc =
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '0' },
          // HSTS — browsers ignore HSTS received over HTTP, so this is only effective over HTTPS.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            // No nonces: Next's own RSC-hydration <script> tags aren't
            // nonce-stamped here — a nonce + 'strict-dynamic' policy blocked
            // every script, including Next's own, so the app never
            // hydrated. 'unsafe-inline' still blocks loading scripts/styles
            // from foreign origins, covering the common supply-chain/
            // injected-script attack; it doesn't stop an inline payload from
            // an XSS bug, but this app has no dangerouslySetInnerHTML
            // anywhere, so React's own escaping is the primary defense there.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              imgSrc,
              "font-src 'self' data:",
              connectSrc,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
