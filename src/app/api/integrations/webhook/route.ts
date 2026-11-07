import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { encryptJson } from '@/lib/crypto';
import { validateWebhookUrl } from '@/lib/core.mjs';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user || !context.workspace) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    if (!['owner','admin'].includes(context.role ?? '')) return NextResponse.json({ error: 'Workspace owner or admin access is required.' }, { status: 403 });
    const body = await request.json();
    const provider = String(body.provider);
    if (!['make','zapier'].includes(provider)) return NextResponse.json({ error: 'Provider must be Make or Zapier.' }, { status: 400 });
    const validated = validateWebhookUrl(body.url);
    if (!validated.ok) return NextResponse.json({ error: validated.reason }, { status: 400 });
    const signingSecret = randomBytes(32).toString('hex');
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('integrations').upsert({
      workspace_id: context.workspace.id, provider, status: 'connected', account_email: null,
      config_ciphertext: encryptJson({ url: validated.url, signingSecret }), updated_at: new Date().toISOString()
    }, { onConflict: 'workspace_id,provider' });
    if (error) throw new Error('Could not save webhook configuration.');
    return NextResponse.json({ integration: { provider, status: 'connected', account_email: null } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook connection failed.' }, { status: 400 });
  }
}
