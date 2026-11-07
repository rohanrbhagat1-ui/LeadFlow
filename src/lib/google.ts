import { google } from 'googleapis';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { decryptJson, encryptJson } from '@/lib/crypto';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events'
];

export function createGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Google OAuth is not configured. Add the client ID, secret, and redirect URI to .env.local.');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function saveGoogleConnection(workspaceId: string, accountEmail: string, credentials: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('integrations').upsert({
    workspace_id: workspaceId,
    provider: 'google_workspace',
    status: 'connected',
    account_email: accountEmail,
    config_ciphertext: encryptJson({ credentials }),
    updated_at: new Date().toISOString()
  }, { onConflict: 'workspace_id,provider' });
  if (error) throw new Error('Could not securely save the Google connection.');
}

export async function getConnectedGoogleClient(workspaceId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('integrations')
    .select('config_ciphertext,account_email')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google_workspace')
    .eq('status', 'connected')
    .maybeSingle();
  if (error || !data?.config_ciphertext) throw new Error('Connect Google first from Integrations.');

  const stored = decryptJson<{ credentials: Record<string, unknown> }>(data.config_ciphertext);
  const client = createGoogleOAuthClient();
  client.setCredentials(stored.credentials as Parameters<typeof client.setCredentials>[0]);
  await client.getAccessToken();
  const refreshed = client.credentials;
  if (refreshed.access_token !== stored.credentials.access_token || refreshed.expiry_date !== stored.credentials.expiry_date) {
    await saveGoogleConnection(workspaceId, data.account_email ?? '', refreshed as unknown as Record<string, unknown>);
  }
  return { client, accountEmail: data.account_email ?? '' };
}

export async function getGoogleConnectionStatus(workspaceId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('integrations')
    .select('provider,status,account_email,updated_at')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google_workspace')
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function deleteGoogleConnection(workspaceId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('integrations').select('config_ciphertext').eq('workspace_id', workspaceId).eq('provider', 'google_workspace').maybeSingle();
  if (data?.config_ciphertext) {
    try {
      const stored = decryptJson<{ credentials: Record<string, unknown> }>(data.config_ciphertext);
      const client = createGoogleOAuthClient();
      client.setCredentials(stored.credentials as Parameters<typeof client.setCredentials>[0]);
      await client.revokeCredentials();
    } catch { /* Best-effort provider revocation; local encrypted token deletion still proceeds. */ }
  }
  const { error } = await admin.from('integrations').delete().eq('workspace_id', workspaceId).eq('provider', 'google_workspace');
  if (error) throw new Error('Could not disconnect Google.');
}
