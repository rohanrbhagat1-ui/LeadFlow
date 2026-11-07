import { createSupabaseServerClient } from '@/lib/supabase/server';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  public_intake_enabled: boolean;
  notification_email: string | null;
};

export async function getWorkspaceContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces!inner(id,name,slug,business_type,public_intake_enabled,notification_email)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership) return { user, workspace: null as Workspace | null, role: null as string | null, supabase };
  const relation = (membership as any).workspaces;
  const workspace = (Array.isArray(relation) ? relation[0] : relation) as Workspace | undefined;
  return { user, workspace: workspace ?? null, role: (membership as any).role as string, supabase };
}
