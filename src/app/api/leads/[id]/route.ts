import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { LEAD_STATUSES } from '@/lib/core.mjs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user || !context.workspace) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    if (!LEAD_STATUSES.includes(String(body.status))) return NextResponse.json({ error: 'Unknown pipeline status.' }, { status: 400 });
    const { data: lead, error } = await context.supabase.from('leads')
      .update({ status: String(body.status), updated_at: new Date().toISOString() })
      .eq('id', id).eq('workspace_id', context.workspace.id).select('*').single();
    if (error || !lead) return NextResponse.json({ error: 'Lead not found or you do not have access.' }, { status: 404 });
    await context.supabase.from('activity_logs').insert({ workspace_id: context.workspace.id, lead_id: lead.id, actor_id: context.user.id, action: 'lead.status_changed', details: { status: lead.status } });
    return NextResponse.json({ lead });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, { status: 500 });
  }
}
