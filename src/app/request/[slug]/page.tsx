import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import IntakeForm from '@/components/intake-form';

export const dynamic = 'force-dynamic';

export default async function PublicRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let workspace: any = null;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from('workspaces').select('name,business_type,slug,public_intake_enabled').eq('slug', slug).maybeSingle();
    workspace = data;
  } catch {
    return <main className="public-shell"><div className="public-card"><h1>Request form unavailable</h1><p>LeadFlow has not completed its database setup yet.</p></div></main>;
  }
  if (!workspace || !workspace.public_intake_enabled) notFound();
  return <IntakeForm workspaceName={workspace.name} slug={workspace.slug} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} />;
}
