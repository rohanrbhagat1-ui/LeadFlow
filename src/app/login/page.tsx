import Link from 'next/link';
import { signInAction } from '@/app/actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <div className="brand-lockup"><span className="brandmark">↗</span><div><b>LeadFlow</b><small>Business operations, connected.</small></div></div>
    <p className="eyebrow">Welcome back</p><h1>Sign in to your workspace.</h1><p className="muted">Your leads, next actions, and connected tools in one place.</p>
    {params.error && <div className="alert error">{params.error}</div>}{params.message && <div className="alert success">{params.message}</div>}
    <form action={signInAction} className="form-stack">
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@business.com"/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={10}/></label>
      <button className="button primary" type="submit">Sign in</button>
    </form>
    <p className="auth-foot">New to LeadFlow? <Link href="/signup">Create a workspace</Link></p>
  </section><p className="auth-legal">LeadFlow is in early development. Use test information until your workspace is fully configured and secured.</p></main>;
}
