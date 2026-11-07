'use client';

import { useMemo, useState, useTransition } from 'react';
import { signOutAction } from '@/app/actions';

type Lead = {
  id: string; customer_name: string; email: string | null; phone: string | null;
  offering: string; location_context: string | null; source: string; status: string;
  estimated_value: number | string; follow_up_at: string | null; notes: string | null;
  contact_permission: boolean; created_at: string;
};
type Workspace = { id: string; name: string; slug: string; business_type: string; public_intake_enabled: boolean; notification_email: string | null };
type Integration = { provider: string; status: string; account_email: string | null };
const stages = [
  ['new','New'],['contacted','Contacted'],['appointment_booked','Appointment booked'],['quote_sent','Quote sent'],['follow_up_due','Follow-up due'],['won','Won'],['lost','Lost']
] as const;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body as T;
}

export default function DashboardClient({ workspace: initialWorkspace, userEmail, role, initialLeads, initialIntegrations, siteUrl }: {
  workspace: Workspace; userEmail: string; role: string; initialLeads: Lead[]; initialIntegrations: Integration[]; siteUrl: string;
}) {
  const [workspace] = useState(initialWorkspace);
  const [leads, setLeads] = useState(initialLeads);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [notice, setNotice] = useState('');
  const [busy, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [webhookProvider, setWebhookProvider] = useState<'make'|'zapier'>('make');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showForm, setShowForm] = useState(false);

  const openLeads = leads.filter((lead) => !['won','lost'].includes(lead.status));
  const dueLeads = openLeads.filter((lead) => lead.status === 'follow_up_due' || (lead.follow_up_at && new Date(lead.follow_up_at).getTime() < Date.now()));
  const pipelineValue = openLeads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const haystack = [lead.customer_name, lead.email, lead.phone, lead.offering, lead.location_context, lead.notes].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [leads, query]);
  const googleConnected = integrations.some((item) => item.provider === 'google_workspace' && item.status === 'connected');
  const webhookConnected = integrations.some((item) => ['make','zapier'].includes(item.provider) && item.status === 'connected');
  const intakeUrl = `${siteUrl.replace(/\/$/, '')}/request/${workspace.slug}`;

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 5000); }
  function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    startTransition(async () => {
      try {
        const result = await api<{ lead: Lead }>('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
        setLeads((current) => [result.lead, ...current]);
        formElement.reset();
        setShowForm(false);
        flash('Inquiry saved. Connected automations were notified where configured.');
      } catch (error) { flash(error instanceof Error ? error.message : 'Could not save lead.'); }
    });
  }
  function updateStatus(leadId: string, status: string) {
    startTransition(async () => {
      try {
        const result = await api<{ lead: Lead }>(`/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        setLeads((current) => current.map((lead) => lead.id === leadId ? result.lead : lead));
        flash('Lead updated.');
      } catch (error) { flash(error instanceof Error ? error.message : 'Could not update lead.'); }
    });
  }
  function sendEmail(lead: Lead) {
    if (!lead.email) return flash('This lead does not have an email address.');
    if (!lead.contact_permission) return flash('Email permission is not recorded for this lead. Record permission before sending.');
    const subject = window.prompt('Email subject', `Following up on your ${lead.offering} inquiry`);
    if (!subject) return;
    const text = window.prompt('Message', `Hi ${lead.customer_name},\n\nI wanted to follow up about your ${lead.offering} inquiry. Please let us know if you have any questions.\n\nThank you`);
    if (!text) return;
    startTransition(async () => {
      try { await api('/api/integrations/google/email', { method: 'POST', body: JSON.stringify({ leadId: lead.id, subject, text }) }); flash('Email sent through the connected Google account.'); }
      catch (error) { flash(error instanceof Error ? error.message : 'Email could not be sent.'); }
    });
  }
  function addCalendarEvent(lead: Lead) {
    const date = window.prompt('Appointment date and time (local), e.g. 2026-11-12T10:00');
    if (!date) return;
    const start = new Date(date);
    if (Number.isNaN(start.getTime())) return flash('That date/time could not be understood.');
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    startTransition(async () => {
      try {
        await api('/api/integrations/google/calendar', { method: 'POST', body: JSON.stringify({ leadId: lead.id, start: start.toISOString(), end: end.toISOString() }) });
        flash('Appointment added to Google Calendar.');
      } catch (error) { flash(error instanceof Error ? error.message : 'Calendar event could not be created.'); }
    });
  }
  async function connectWebhook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await api<{ integration: Integration }>('/api/integrations/webhook', { method: 'POST', body: JSON.stringify({ provider: webhookProvider, url: webhookUrl }) });
        setIntegrations((items) => [...items.filter((item) => item.provider !== result.integration.provider), result.integration]);
        setWebhookUrl('');
        flash(`${webhookProvider === 'make' ? 'Make' : 'Zapier'} webhook connected. New inquiries will be forwarded.`);
      } catch (error) { flash(error instanceof Error ? error.message : 'Webhook could not be connected.'); }
    });
  }
  async function copyIntakeLink() {
    try { await navigator.clipboard.writeText(intakeUrl); flash('Public inquiry link copied.'); }
    catch { flash(`Copy this link: ${intakeUrl}`); }
  }
  async function disconnectGoogle() {
    if (!window.confirm('Disconnect Google Gmail and Calendar from this workspace?')) return;
    startTransition(async () => {
      try { await api('/api/integrations/google/disconnect', { method: 'POST', body: '{}' }); setIntegrations((items) => items.filter((item) => item.provider !== 'google_workspace')); flash('Google disconnected.'); }
      catch (error) { flash(error instanceof Error ? error.message : 'Disconnect failed.'); }
    });
  }

  return <main className="app-shell">
    <header className="app-top">
      <div className="app-title"><span className="brandmark">↗</span><div><h1>LeadFlow</h1><p>Small-business operating layer · cloud workspace</p></div></div>
      <div className="app-actions"><span className="workspace-chip">{workspace.name} · {role}</span><span className="workspace-chip">{userEmail}</span><form action={signOutAction}><button className="button secondary" type="submit">Sign out</button></form></div>
    </header>
    <section className="stats">
      <div className="stat"><small>Open opportunities</small><strong>{openLeads.length}</strong></div>
      <div className="stat"><small>Follow-ups requiring attention</small><strong>{dueLeads.length}</strong></div>
      <div className="stat"><small>Open pipeline value</small><strong>${pipelineValue.toLocaleString('en-US',{maximumFractionDigits:0})}</strong></div>
      <div className="stat"><small>Closed won</small><strong>{leads.filter((lead) => lead.status === 'won').length}</strong></div>
    </section>
    {notice && <div className="alert success" role="status">{notice}</div>}
    <div className="layout-grid">
      <div className="main-stack">
        <section className="panel">
          <h2>Capture an opportunity</h2><p className="sub">Create a lead in the cloud database. Team members in this workspace see the same record.</p>
          {!showForm ? <button className="button primary" onClick={() => setShowForm(true)}>＋ New inquiry</button> : <form className="lead-form" onSubmit={createLead}>
            <label>Customer name *<input name="customer_name" required maxLength={90} placeholder="Jamie Parker"/></label>
            <label>Service / product *<input name="offering" required maxLength={120} placeholder="Lawn maintenance, tutoring, cleaning…"/></label>
            <label>Email<input name="email" type="email" placeholder="customer@example.com"/></label>
            <label>Phone<input name="phone" placeholder="(555) 010-0123"/></label>
            <label>Location / context<input name="location_context" placeholder="Address, online, project notes"/></label>
            <label>Source<select name="source"><option>Website</option><option>Phone</option><option>Email</option><option>Referral</option><option>Social media</option><option>Repeat customer</option><option>Other</option></select></label>
            <label>Estimated value ($)<input name="estimated_value" type="number" min="0" step="0.01" defaultValue="0"/></label>
            <label>Follow-up date<input name="follow_up_at" type="date"/></label>
            <label className="wide">Notes<textarea name="notes" rows={3} maxLength={1500} placeholder="What did they ask for? What happens next?"/></label>
            <label className="checkboxrow wide"><input name="contact_permission" type="checkbox" value="true"/> Customer has agreed to email follow-up.</label>
            <div className="wide" style={{display:'flex',gap:8}}><button className="button primary" disabled={busy}>Save inquiry</button><button className="button secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
          </form>}
        </section>
        <section className="panel">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2>Opportunity pipeline</h2><p className="sub">A shared, searchable list of customer requests and next actions.</p></div><input aria-label="Search leads" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers…" style={{maxWidth:240,background:'#0d1511',border:'1px solid #34483a',borderRadius:9,padding:10,color:'white'}}/></div>
          <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Request</th><th>Value</th><th>Stage</th><th>Contact</th></tr></thead><tbody>
            {filteredLeads.map((lead) => <tr key={lead.id}>
              <td><strong>{lead.customer_name}</strong><small>{lead.email || lead.phone || 'No contact details'}</small></td>
              <td>{lead.offering}<small>{lead.source}{lead.follow_up_at ? ` · Follow up ${new Date(lead.follow_up_at).toLocaleDateString()}` : ''}</small></td>
              <td>${Number(lead.estimated_value || 0).toLocaleString('en-US',{maximumFractionDigits:0})}</td>
              <td><select className="status-select" value={lead.status} onChange={(event) => updateStatus(lead.id,event.target.value)} aria-label={`Status for ${lead.customer_name}`}>{stages.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td>
              <td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button className="button secondary" disabled={!googleConnected || !lead.email || !lead.contact_permission || busy} onClick={() => sendEmail(lead)} title={!lead.contact_permission?'Record email permission first':'Send email through Gmail'}>Email</button><button className="button secondary" disabled={!googleConnected || busy} onClick={() => addCalendarEvent(lead)}>Calendar</button></div></td>
            </tr>)}
            {!filteredLeads.length && <tr><td colSpan={5} style={{color:'#9eafa3'}}>No leads found. Capture the first inquiry above or use the public form.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
      <aside className="main-stack">
        <section className="panel">
          <h2>Connect real apps</h2><p className="sub">Authorize services for this business workspace. Credentials stay server-side and are encrypted before storage.</p>
          <div className="connection"><div><b>Google Workspace</b><small>Gmail send and Google Calendar events</small>{googleConnected && <small>Connected: {integrations.find((item)=>item.provider==='google_workspace')?.account_email}</small>}</div><div className="right">{googleConnected ? <><span className="pill">Connected</span><button className="button ghost" onClick={disconnectGoogle}>Disconnect</button></> : <a className="button primary" href="/api/integrations/google/connect">Connect</a>}</div></div>
          <div className="connection"><div><b>Make / Zapier</b><small>Forward new inquiries into your automation flows</small></div><span className="pill">{webhookConnected?'Connected':'Not connected'}</span></div>
          <form className="webhook-form" onSubmit={connectWebhook}>
            <label>Automation provider<select value={webhookProvider} onChange={(event)=>setWebhookProvider(event.target.value as 'make'|'zapier')}><option value="make">Make</option><option value="zapier">Zapier</option></select></label>
            <label>HTTPS webhook URL<input value={webhookUrl} onChange={(event)=>setWebhookUrl(event.target.value)} placeholder="https://hook.us1.make.com/…" required/></label>
            <button className="button secondary" disabled={busy}>Connect webhook</button>
          </form>
          <p className="notice">New lead event: <code>lead.created</code>. The webhook payload includes the customer contact details entered into LeadFlow. Connect only an automation workspace you control.</p>
        </section>
        <section className="panel">
          <h2>Website inquiry form</h2><p className="sub">Give customers a link to send requests directly into this workspace.</p>
          <div style={{background:'#0d1511',border:'1px solid #34483a',borderRadius:10,padding:11,fontSize:10,wordBreak:'break-all'}}>{intakeUrl}</div>
          <button className="button primary" style={{marginTop:10}} onClick={copyIntakeLink}>Copy public form link</button>
          <p className="notice">Public intake uses a database-backed rate limit and a honeypot field. Add Cloudflare Turnstile before publishing the form widely.</p>
        </section>
        <section className="panel">
          <h2>Workspace profile</h2><p className="sub">The database is shared across signed-in team members. The first version provisions one owner per signup.</p>
          <div className="connection"><div><b>Business category</b><small>{workspace.business_type.replaceAll('_',' ')}</small></div></div>
          <div className="connection"><div><b>Public intake</b><small>{workspace.public_intake_enabled?'Enabled':'Disabled'}</small></div><span className="pill">{leads.length} records</span></div>
          <p className="notice">Multi-user invitations, role editing, Google token revocation UI, and subscription billing are planned follow-on work.</p>
        </section>
      </aside>
    </div>
    <p className="footer-note">LeadFlow v0.5 · Supabase cloud database · Google OAuth · Signed Make/Zapier webhooks · Early-access build</p>
  </main>;
}
