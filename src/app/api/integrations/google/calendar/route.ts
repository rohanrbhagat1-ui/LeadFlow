import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getWorkspaceContext } from '@/lib/auth';
import { getConnectedGoogleClient } from '@/lib/google';

export async function POST(request: Request) {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user || !context.workspace) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const body = await request.json();
    const { data: lead } = await context.supabase.from('leads').select('id,customer_name,email,phone,offering,location_context').eq('id', String(body.leadId)).eq('workspace_id', context.workspace.id).maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    const start = new Date(String(body.start));
    const end = new Date(String(body.end));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > 8 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Choose a valid event time up to eight hours long.' }, { status: 400 });
    }
    const { client } = await getConnectedGoogleClient(context.workspace.id);
    const calendar = google.calendar({ version: 'v3', auth: client });
    const result = await calendar.events.insert({ calendarId: 'primary', requestBody: {
      summary: `${lead.offering} — ${lead.customer_name}`,
      description: [`LeadFlow customer: ${lead.customer_name}`, `Email: ${lead.email ?? 'Not provided'}`, `Phone: ${lead.phone ?? 'Not provided'}`, `Context: ${lead.location_context ?? 'Not provided'}`].join('\n'),
      start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }
    }});
    await context.supabase.from('activity_logs').insert({ workspace_id: context.workspace.id, lead_id: lead.id, actor_id: context.user.id, action: 'calendar.event_created', details: { provider: 'google_calendar', event_id: result.data.id } });
    return NextResponse.json({ ok: true, eventId: result.data.id, htmlLink: result.data.htmlLink });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Calendar event could not be created.' }, { status: 400 });
  }
}
