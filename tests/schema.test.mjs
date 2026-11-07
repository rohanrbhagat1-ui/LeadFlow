import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/0001_initial.sql', import.meta.url), 'utf8');
const admin = await readFile(new URL('../src/lib/supabase/admin.ts', import.meta.url), 'utf8');

test('workspace and lead tables enable RLS', () => {
  for (const table of ['workspaces','workspace_members','leads','activity_logs','integrations','integration_events','public_intake_rate_limits']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
});

test('lead visibility and writes are scoped to workspace membership', () => {
  assert.match(sql, /members can read leads[\s\S]*?is_workspace_member\(workspace_id\)/i);
  assert.match(sql, /members can create leads[\s\S]*?is_workspace_member\(workspace_id\)/i);
  assert.match(sql, /members can update leads[\s\S]*?is_workspace_member\(workspace_id\)/i);
});

test('integration secret tables have no end-user policy and are server-key accessed', () => {
  assert.match(sql, /No end-user policies on integrations/i);
  assert.doesNotMatch(sql, /create policy[^;]+on public\.integrations/i);
  assert.match(admin, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test('public lead RPC is service-role only', () => {
  assert.match(sql, /revoke all on function public\.create_public_lead[\s\S]*?from anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_public_lead[\s\S]*?to service_role/i);
});

test('auth signup trigger provisions the initial workspace and owner membership', () => {
  assert.match(sql, /after insert on auth\.users/i);
  assert.match(sql, /insert into public\.workspaces/i);
  assert.match(sql, /insert into public\.workspace_members[\s\S]*?'owner'/i);
});

test('signup business type is restricted to supported presets', () => {
  assert.match(sql, /v_type not in \('landscaping','cleaning','home_repair','tutoring','auto_detailing','pet_care','professional_services','photography','retail','other'\)/i);
});

test('Turnstile site and secret keys are required as a pair', async () => {
  const route = await readFile(new URL('../src/app/api/intake/[slug]/route.ts', import.meta.url), 'utf8');
  assert.match(route, /Boolean\(turnstileSecret\) !== Boolean\(turnstileSiteKey\)/);
  assert.match(route, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
});

test('third-party webhook payload uses an explicit lead-field allowlist', async () => {
  const dispatch = await readFile(new URL('../src/lib/integrations/dispatch.ts', import.meta.url), 'utf8');
  assert.match(dispatch, /const safeLead: LeadEvent = \{/);
  assert.match(dispatch, /lead: safeLead/);
  assert.doesNotMatch(dispatch, /lead,\s*\n\s*\};/);
});
