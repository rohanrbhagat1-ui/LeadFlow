import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { dispatchLeadCreated } from '@/lib/integrations/dispatch';

export async function POST(request: Request) {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user || !context.workspace) return NextResponse.json({ error: 'Sign in to a workspace first.' }, { status: 401 });
    const body = await request.json();
    const customerName = String(body.customer_name ?? '').trim();
    const offering = String(body.offering ?? '').trim();
    if (customerName.length < 2 || customerName.length > 90) return NextResponse.json({ error: 'Customer name must be 2–90 characters.' }, { status: 400 });
    if (!offering || offering.length > 120) return NextResponse.json({ error: 'Enter a service, product, or request (120 characters maximum).' }, { status: 400 });
    const value = Number(body.estimated_value ?? 0);
    if (!Number.isFinite(value) || value < 0 || value > 10_000_000) return NextResponse.json({ error: 'Enter a valid estimated value.' }, { status: 400 });
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const location = String(body.location_context ?? '').trim();
    const notes = String(body.notes ?? '');
    if (email && (email.length > 120 || !/^\S+@\S+\.\S+$/.test(email))) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    if (phone.length > 30 || location.length > 160 || notes.length > 1500) return NextResponse.json({ error: 'One of the fields is longer than allowed.' }, { status: 400 });
    let followUp: string | null = null;
    if (body.follow_up_at) {
      const dateText = String(body.follow_up_at);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return NextResponse.json({ error: 'Follow-up date must use YYYY-MM-DD.' }, { status: 400 });
      const parsed = new Date(`${dateText}T12:00:00`);
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Follow-up date is invalid.' }, { status: 400 });
      followUp = parsed.toISOString();
    }

    const { data: lead, error } = await context.supabase.from('leads').insert({
      workspace_id: context.workspace.id,
      created_by: context.user.id,
      customer_name: customerName,
      email: email || null,
      phone: phone || null,
      offering,
      location_context: location || null,
      source: String(body.source ?? 'Manual').slice(0, 60),
      status: 'new',
      estimated_value: value,
      follow_up_at: followUp,
      notes: notes || null,
      contact_permission: body.contact_permission === true || body.contact_permission === 'true'
    }).select('*').single();
    if (error || !lead) return NextResponse.json({ error: 'The lead could not be saved. Check the database migration and workspace access.' }, { status: 400 });

    await context.supabase.from('activity_logs').insert({
      workspace_id: context.workspace.id, lead_id: lead.id, actor_id: context.user.id,
      action: 'lead.created', details: { source: lead.source }
    });
    await dispatchLeadCreated(context.workspace.id, lead, context.workspace.notification_email);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, { status: 500 });
  }
}
