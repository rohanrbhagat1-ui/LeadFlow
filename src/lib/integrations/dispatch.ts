import { createHmac } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { decryptJson } from '@/lib/crypto';

export type LeadEvent = {
  id: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  offering: string;
  source: string;
  status: string;
  created_at: string;
};

async function logIntegrationEvent(workspaceId: string, provider: string, event: string, success: boolean, message: string, httpStatus?: number) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('integration_events').insert({
      workspace_id: workspaceId, provider, event, success,
      message: message.slice(0, 500), http_status: httpStatus ?? null
    });
  } catch {
    // Logging must never cause the main lead-capture workflow to fail.
  }
}

export async function dispatchLeadCreated(workspaceId: string, lead: LeadEvent, notificationEmail?: string | null) {
  let admin;
  try { admin = createSupabaseAdminClient(); } catch { return; }
  const { data: connections } = await admin.from('integrations')
    .select('provider,config_ciphertext')
    .eq('workspace_id', workspaceId)
    .in('provider', ['zapier', 'make'])
    .eq('status', 'connected');

  // Explicit allowlist: do not forward internal IDs, notes, consent flags, or
  // other database columns to third-party automation services by accident.
  const safeLead: LeadEvent = {
    id: lead.id,
    customer_name: lead.customer_name,
    email: lead.email,
    phone: lead.phone,
    offering: lead.offering,
    source: lead.source,
    status: lead.status,
    created_at: lead.created_at
  };
  const payload = {
    event: 'lead.created',
    occurred_at: new Date().toISOString(),
    workspace_id: workspaceId,
    lead: safeLead
  };

  for (const connection of connections ?? []) {
    try {
      const config = decryptJson<{ url: string; signingSecret: string }>(connection.config_ciphertext);
      const body = JSON.stringify(payload);
      const signature = createHmac('sha256', config.signingSecret).update(body).digest('hex');
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-leadflow-signature': `sha256=${signature}`, 'x-leadflow-event': 'lead.created' },
        body,
        signal: AbortSignal.timeout(7000),
        cache: 'no-store',
        redirect: 'error'
      });
      await logIntegrationEvent(workspaceId, connection.provider, 'lead.created', response.ok, response.ok ? 'Webhook delivered.' : `Webhook returned HTTP ${response.status}.`, response.status);
    } catch (error) {
      await logIntegrationEvent(workspaceId, connection.provider, 'lead.created', false, error instanceof Error ? error.message : 'Webhook delivery failed.');
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (resendKey && from && notificationEmail) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [notificationEmail],
          subject: `New LeadFlow inquiry: ${lead.customer_name}`,
          text: [
            `A new inquiry was captured in your LeadFlow workspace.`,
            `Customer: ${lead.customer_name}`,
            `Offering: ${lead.offering}`,
            `Email: ${lead.email ?? 'Not provided'}`,
            `Phone: ${lead.phone ?? 'Not provided'}`,
            `Source: ${lead.source}`,
            `Open LeadFlow to assign an owner and set the next action.`
          ].join('\n')
        }),
        signal: AbortSignal.timeout(7000),
        cache: 'no-store',
        redirect: 'error'
      });
      await logIntegrationEvent(workspaceId, 'resend', 'lead.created.notification', response.ok, response.ok ? 'Owner notification sent.' : `Resend returned HTTP ${response.status}.`, response.status);
    } catch (error) {
      await logIntegrationEvent(workspaceId, 'resend', 'lead.created.notification', false, error instanceof Error ? error.message : 'Notification failed.');
    }
  }
}
