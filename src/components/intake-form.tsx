'use client';

import { useState } from 'react';
import Script from 'next/script';

export default function IntakeForm({ workspaceName, slug, turnstileSiteKey }: { workspaceName: string; slug: string; turnstileSiteKey: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/intake/${encodeURIComponent(slug)}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Your request could not be sent. Please try again.');
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Request could not be sent.'); }
    finally { setBusy(false); }
  }
  return <main className="public-shell">{turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />}<section className="public-card">
    <div className="brand-lockup"><span className="brandmark">↗</span><div><b>{workspaceName}</b><small>Customer inquiry form · powered by LeadFlow</small></div></div>
    {done ? <div className="success-panel"><strong>Request received.</strong><p>Thank you for contacting {workspaceName}. Your request has been sent to the business. They can follow up using the contact details you provided.</p></div> : <>
      <p className="eyebrow">Start a conversation</p><h1>How can we help?</h1><p>Share a few details about what you need. The business will receive your request and can follow up with you.</p>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <label>Your name<input name="customer_name" required maxLength={90} autoComplete="name"/></label>
        <label>Email<input name="email" type="email" required maxLength={120} autoComplete="email"/></label>
        <label>Phone (optional)<input name="phone" type="tel" maxLength={30} autoComplete="tel"/></label>
        <label>What do you need?<input name="offering" required maxLength={120} placeholder="e.g. recurring lawn service"/></label>
        <label>Location or relevant context<input name="location_context" maxLength={160} placeholder="City, property type, online request…"/></label>
        <label>Additional details<textarea name="notes" rows={4} maxLength={1500} placeholder="Tell the business a little more about your request."/></label>
        <label className="checkboxrow"><input type="checkbox" name="contact_permission" required/> I agree that this business may contact me about this request.</label>
        <div className="hidden-honeypot" aria-hidden="true"><label>Leave this field empty<input name="company_website" tabIndex={-1} autoComplete="off"/></label></div>
        {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />}
        <button className="button primary" disabled={busy}>{busy?'Sending…':'Send request'}</button>
      </form>
    </>}
    <div className="footer-note">Secure inquiry form · Do not include payment details or highly sensitive personal information.</div>
  </section></main>;
}
