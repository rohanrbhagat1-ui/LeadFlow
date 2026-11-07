import { redirect } from 'next/navigation';
import DashboardClient from '@/components/dashboard-client';
import { requireWorkspace } from '@/lib/workspace';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const context = await requireWorkspace();
  if (!context) redirect('/login');
  const { supabase, user, workspace, role } = context;
  const { data: leads, error } = await supabase.from('leads')
    .select('id,customer_name,email,phone,offering,location_context,source,status,estimated_value,follow_up_at,notes,contact_permission,created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('Could not load workspace leads. Check the database migration and row-level security policies.');

  let integrations: { provider: string; status: string; account_email: string | null }[] = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from('integrations').select('provider,status,account_email').eq('workspace_id', workspace.id);
    integrations = data ?? [];
  } catch {
    // The user can still use the CRM while server integration secrets are being configured.
  }

  return <DashboardClient
    workspace={workspace}
    userEmail={user.email ?? ''}
    role={role}
    initialLeads={leads ?? []}
    initialIntegrations={integrations}
    siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}
  />;
}
