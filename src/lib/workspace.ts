import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces!inner(id,name,slug,business_type,public_intake_enabled,notification_email)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (error || !member) return null;
  const relation = (member as any).workspaces;
  const workspace = (Array.isArray(relation) ? relation[0] : relation) as any;
  if (!workspace) return null;
  return { supabase, user, workspace, role: (member as any).role as string };
}
