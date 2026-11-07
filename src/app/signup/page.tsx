import Link from 'next/link';
import { signUpAction } from '@/app/actions';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <div className="brand-lockup"><span className="brandmark">↗</span><div><b>LeadFlow</b><small>Build your business workspace.</small></div></div>
    <p className="eyebrow">Start with the essentials</p><h1>Create your workspace.</h1><p className="muted">Your business gets a private workspace for leads and follow-up.</p>
    {params.error && <div className="alert error">{params.error}</div>}
    <form action={signUpAction} className="form-stack">
      <label>Business name<input name="business_name" required maxLength={90} placeholder="Oak & Stone Services"/></label>
      <label>Business type<select name="business_type" defaultValue="landscaping"><option value="landscaping">Landscaping & lawn care</option><option value="cleaning">Cleaning services</option><option value="home_repair">Home repair & trades</option><option value="tutoring">Tutoring & education</option><option value="auto_detailing">Auto detailing</option><option value="pet_care">Pet care</option><option value="professional_services">Professional services</option><option value="photography">Photography & events</option><option value="retail">Retail</option><option value="other">Other small business</option></select></label>
      <label>Work email<input name="email" type="email" autoComplete="email" required placeholder="you@business.com"/></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="At least 10 characters"/></label>
      <button className="button primary" type="submit">Create workspace</button>
    </form>
    <p className="auth-foot">Already have a workspace? <Link href="/login">Sign in</Link></p>
  </section><p className="auth-legal">Use an adult-managed account for provider accounts, billing, contracts, and business registration where required.</p></main>;
}
