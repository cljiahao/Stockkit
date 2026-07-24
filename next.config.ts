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
    ],
  },

  async headers() {
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
          // CSP baseline — tighten after auth/analytics are wired. frame-ancestors replaces X-Frame-Options for CSP2+ browsers.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
