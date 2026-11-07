import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context?.user || !context.workspace) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from('integrations').select('provider,status,account_email,updated_at').eq('workspace_id', context.workspace.id);
    return NextResponse.json({ integrations: data ?? [] });
  } catch {
    return NextResponse.json({ integrations: [], warning: 'Server integration storage is not configured.' });
  }
}
