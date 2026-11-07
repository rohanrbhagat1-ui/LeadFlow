import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getWorkspaceContext } from '@/lib/auth';
import { createGoogleOAuthClient, saveGoogleConnection } from '@/lib/google';

const STATE_COOKIE = 'leadflow_google_state';
const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/integrations/google/callback',
  maxAge: 0
};

function redirectWithStateCleared(destination: string, origin: string) {
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(STATE_COOKIE, '', STATE_COOKIE_OPTIONS);
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const denied = url.searchParams.get('error');

  // Read the request cookie before preparing a response that expires it.
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value ?? '';
  const stateBytes = Buffer.from(state, 'utf8');
  const savedBytes = Buffer.from(savedState, 'utf8');
  const safeEqual = stateBytes.length > 0 && stateBytes.length === savedBytes.length && timingSafeEqual(savedBytes, stateBytes);

  if (denied) {
    return redirectWithStateCleared('/dashboard?integrationError=Google+authorization+was+cancelled', url.origin);
  }
  if (!code || !state || !safeEqual) {
    return redirectWithStateCleared('/dashboard?integrationError=Google+connection+state+did+not+match', url.origin);
  }

  const context = await getWorkspaceContext();
  if (!context?.user || !context.workspace) {
    return redirectWithStateCleared('/login?message=Sign+in+before+connecting+Google', url.origin);
  }

  try {
    const oauth = createGoogleOAuthClient();
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not provide a refresh token. Disconnect LeadFlow from your Google account security settings, then connect again.');
    }
    oauth.setCredentials(tokens);
    const userInfo = await google.oauth2({ version: 'v2', auth: oauth }).userinfo.get();
    const emailFromScope = userInfo.data.email ?? context.user.email ?? 'Google account';
    await saveGoogleConnection(context.workspace.id, emailFromScope, oauth.credentials as unknown as Record<string, unknown>);
    return redirectWithStateCleared('/dashboard?connected=google', url.origin);
  } catch {
    // Keep provider error details and token-related data out of redirect URLs.
    return redirectWithStateCleared('/dashboard?integrationError=Google+connection+failed.+Check+OAuth+configuration+and+try+again', url.origin);
  }
}
