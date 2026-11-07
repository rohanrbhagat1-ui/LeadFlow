import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { dispatchLeadCreated } from '@/lib/integrations/dispatch';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    // Honeypot: return a generic success to bots without creating a record.
    if (String(body.company_website ?? '').trim()) return NextResponse.json({ ok: true });
    const customerName = String(body.customer_name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const offering = String(body.offering ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const location = String(body.location_context ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const hasConsent = body.contact_permission === true || body.contact_permission === 'on' || body.contact_permission === 'true';
    if (customerName.length < 2 || customerName.length > 90 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 120 || phone.length > 30 || location.length > 160 || notes.length > 1500 || offering.length < 1 || offering.length > 120 || !hasConsent) {
      return NextResponse.json({ error: 'Please provide your name, a valid email, what you need, and permission for the business to reply about this request.' }, { status: 400 });
    }
    const rateSecret = process.env.INTAKE_RATE_LIMIT_SECRET;
    if (!rateSecret || rateSecret.length < 24) return NextResponse.json({ error: 'The inquiry form is not fully configured yet.' }, { status: 503 });

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (Boolean(turnstileSecret) !== Boolean(turnstileSiteKey)) {
      return NextResponse.json({ error: 'The anti-spam check is only partially configured. Contact the business.' }, { status: 503 });
    }
    if (turnstileSecret) {
      const token = String(body['cf-turnstile-response'] ?? '');
      if (!token) return NextResponse.json({ error: 'Please complete the anti-spam check.' }, { status: 400 });
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret, response: token }),
        signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error'
      });
      const result = await verify.json();
      if (!result.success) return NextResponse.json({ error: 'The anti-spam check could not be verified.' }, { status: 400 });
    }

    const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHmac('sha256', rateSecret).update(forwarded).digest('hex');
    const admin = createSupabaseAdminClient();
    const { data: leadId, error } = await admin.rpc('create_public_lead', {
      p_slug: slug,
      p_customer_name: customerName,
      p_email: email,
      p_phone: phone,
      p_offering: offering,
      p_location_context: location,
      p_notes: notes,
      p_ip_hash: ipHash
    });
    if (error || !leadId) {
      const isRateLimited = Boolean(error?.message?.toLowerCase().includes('rate limit'));
      return NextResponse.json({ error: isRateLimited ? 'Too many requests. Please wait a minute and try again.' : 'The request could not be submitted. Please try again later.' }, { status: isRateLimited ? 429 : 400 });
    }

    // Load the new record and workspace notification destination through the server-only admin client.
    const [{ data: lead }, { data: workspace }] = await Promise.all([
      admin.from('leads').select('*').eq('id', leadId).single(),
      admin.from('workspaces').select('id,notification_email').eq('slug', slug).single()
    ]);
    if (lead && workspace) await dispatchLeadCreated(workspace.id, lead, workspace.notification_email);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Rate limit')) return NextResponse.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'The request could not be submitted. Please try again later.' }, { status: 500 });
  }
}
