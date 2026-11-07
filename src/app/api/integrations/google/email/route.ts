import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getWorkspaceContext } from '@/lib/auth';
import { getConnectedGoogleClient } from '@/lib/google';
import { makeGmailRawMessage } from '@/lib/core.mjs';

export async function POST(request: Request) {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user || !context.workspace) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const body = await request.json();
    const { data: lead } = await context.supabase.from('leads').select('id,email,contact_permission').eq('id', String(body.leadId)).eq('workspace_id', context.workspace.id).maybeSingle();
    if (!lead?.email) return NextResponse.json({ error: 'Lead email not found.' }, { status: 404 });
    if (!lead.contact_permission) return NextResponse.json({ error: 'Email permission is not recorded for this lead.' }, { status: 403 });
    const { client } = await getConnectedGoogleClient(context.workspace.id);
    const raw = makeGmailRawMessage({ to: lead.email, subject: String(body.subject ?? ''), text: String(body.text ?? '') });
    const gmail = google.gmail({ version: 'v1', auth: client });
    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    await context.supabase.from('activity_logs').insert({ workspace_id: context.workspace.id, lead_id: lead.id, actor_id: context.user.id, action: 'email.sent', details: { provider: 'gmail', message_id: result.data.id } });
    return NextResponse.json({ ok: true, messageId: result.data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Email could not be sent.' }, { status: 400 });
  }
}
