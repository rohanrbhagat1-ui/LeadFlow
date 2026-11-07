import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { createGoogleOAuthClient, GOOGLE_SCOPES } from '@/lib/google';

export async function GET(request: Request) {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user || !context.workspace) return NextResponse.redirect(new URL('/login', request.url));
    const state = randomBytes(32).toString('hex');
    const oauth = createGoogleOAuthClient();
    const url = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', include_granted_scopes: true, scope: GOOGLE_SCOPES, state });
    const response = NextResponse.redirect(url);
    response.cookies.set('leadflow_google_state', state, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      path: '/api/integrations/google/callback', maxAge: 600
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google OAuth could not start.';
    return NextResponse.redirect(new URL(`/dashboard?integrationError=${encodeURIComponent(message)}`, request.url));
  }
}
