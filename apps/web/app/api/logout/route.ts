import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (token?.refreshToken && token?.accessToken) {
      await fetch(`${process.env.API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: token.refreshToken }),
      });
    }
  } catch {
    // Swallow — logout always succeeds from user's perspective
  }
  return Response.json({ ok: true });
}
