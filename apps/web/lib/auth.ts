import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

async function refreshAccessToken(token: Record<string, unknown>) {
  if (!token.refreshToken) return { ...token, error: 'RefreshAccessTokenError' };
  try {
    const res = await fetch(`${process.env.API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const json = await res.json();
    return {
      ...token,
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
      accessTokenExpiry: Date.now() + 14 * 60 * 1000,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        try {
          const res = await fetch(`${process.env.API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });
          const json = await res.json();
          if (!res.ok) return null;
          const { user, accessToken, refreshToken } = json.data;
          return { ...user, accessToken, refreshToken };
        } catch {
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          // P1: Pass internal secret so the API can reject direct external calls
          if (process.env.INTERNAL_API_SECRET) {
            headers['x-internal-secret'] = process.env.INTERNAL_API_SECRET;
          }
          const res = await fetch(`${process.env.API_URL}/api/v1/auth/oauth/callback`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              provider: 'google',
              oauthId: account.providerAccountId,
              email: user.email,
              name: user.name,
              avatarUrl: user.image,
              // P2: Forward Google's email_verified claim to prevent account-takeover linking
              emailVerified: (profile as Record<string, unknown> | undefined)?.email_verified ?? false,
            }),
          });
          if (!res.ok) return false;
          const json = await res.json();
          const u = user as unknown as Record<string, unknown>;
          u.accessToken = json.data.accessToken;
          u.refreshToken = json.data.refreshToken;
          u.id = json.data.user.id;
          u.role = json.data.user.role;
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // Initial sign-in — store tokens + expiry
      if (user) {
        const u = user as unknown as Record<string, string>;
        return {
          ...token,
          accessToken: u.accessToken,
          refreshToken: u.refreshToken,
          accessTokenExpiry: Date.now() + 14 * 60 * 1000,
          role: u.role,
          userId: u.id,
        };
      }
      // Token still valid
      if (Date.now() < (token.accessTokenExpiry as number)) {
        return token;
      }
      // Access token expired — silently refresh
      return refreshAccessToken(token as Record<string, unknown>);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.role = token.role as string;
      session.user.id = token.userId as string;
      if (token.error) session.error = token.error as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
};

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    error?: string;
    user: { id: string; role: string; name?: string | null; email?: string | null; image?: string | null };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiry?: number;
    role?: string;
    userId?: string;
    error?: string;
  }
}
