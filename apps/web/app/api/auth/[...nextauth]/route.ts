import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { NextRequest } from 'next/server';

/**
 * Detect the base URL from the incoming request.
 *
 * Rules:
 * - Public domains / localhost → use the request host as-is (covers prod + laptop dev).
 * - Private-network IPs (192.168.x, 10.x, 172.16-31.x) + OAuth provider flow
 *   (signin/google, callback/google, etc.) → fall back to NEXTAUTH_URL env var.
 *   Google and other OAuth providers reject private IP redirect_uris.
 * - Private-network IPs + credentials flow → use the request host so the
 *   post-login redirect lands back on the correct LAN IP (fixes mobile blank page).
 */
function detectBaseUrl(req: NextRequest): string {
  const host =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    'localhost:3000';

  const isPrivateNet =
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

  if (isPrivateNet) {
    const path = req.nextUrl?.pathname ?? '';
    // OAuth provider paths (not credentials): Google etc. reject private IPs
    const isOAuthProviderFlow =
      /\/api\/auth\/(signin|callback)\/(?!credentials)/.test(path);

    if (isOAuthProviderFlow) {
      // Return env-var URL so Google sees a localhost redirect_uri it accepts.
      // Note: Google OAuth on mobile requires ngrok — see DEVELOPMENT.md.
      return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    }

    return `http://${host}`;
  }

  const isLocal =
    host.startsWith('localhost') || host.startsWith('127.');
  const proto =
    req.headers.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https');

  return `${proto}://${host}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextAuth = NextAuth(authOptions) as (...args: any[]) => any;

async function handler(
  req: NextRequest,
  ctx: { params: { nextauth: string[] } },
) {
  const original = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL = detectBaseUrl(req);
    return await nextAuth(req, ctx);
  } finally {
    // Restore original value to prevent cross-request contamination.
    // The try/finally + await guarantees this runs after the response is built.
    process.env.NEXTAUTH_URL = original;
  }
}

export { handler as GET, handler as POST };
