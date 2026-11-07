-- LeadFlow v0.5: multi-tenant schema, RLS, and public website intake.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 90),
  slug text not null unique,
  business_type text not null default 'other',
  notification_email text,
  public_intake_enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','manager','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workspace_members m where m.workspace_id = target_workspace and m.user_id = auth.uid()) $$;

create or replace function public.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workspace_members m where m.workspace_id = target_workspace and m.user_id = auth.uid() and m.role = any(allowed_roles)) $$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid,text[]) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid,text[]) to authenticated;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 90),
  email text,
  phone text,
  offering text not null check (char_length(offering) between 1 and 120),
  location_context text,
  source text not null default 'Website',
  status text not null default 'new' check (status in ('new','contacted','appointment_booked','quote_sent','follow_up_due','won','lost')),
  estimated_value numeric(12,2) not null default 0 check (estimated_value >= 0),
  follow_up_at timestamptz,
  notes text,
  contact_permission boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_workspace_created_idx on public.leads(workspace_id, created_at desc);
create index if not exists leads_workspace_status_idx on public.leads(workspace_id, status);
create index if not exists leads_follow_up_idx on public.leads(workspace_id, follow_up_at) where follow_up_at is not null;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_workspace_created_idx on public.activity_logs(workspace_id, created_at desc);

-- Integration credentials are encrypted by the application and are service-role-only.
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('google_workspace','zapier','make')),
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  account_email text,
  config_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, provider)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  event text not null,
  success boolean not null,
  message text not null,
  http_status integer,
  created_at timestamptz not null default now()
);

-- Small database-backed public-intake rate limiter. IP addresses are hashed before storage.
create table if not exists public.public_intake_rate_limits (
  ip_hash text not null check (char_length(ip_hash) = 64),
  bucket_start timestamptz not null,
  hits integer not null default 1,
  primary key (ip_hash, bucket_start)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.leads enable row level security;
alter table public.activity_logs enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_events enable row level security;
alter table public.public_intake_rate_limits enable row level security;

drop policy if exists "members can read their workspaces" on public.workspaces;
drop policy if exists "owners and admins can update workspace" on public.workspaces;
drop policy if exists "members can read workspace members" on public.workspace_members;
drop policy if exists "members can read leads" on public.leads;
drop policy if exists "members can create leads" on public.leads;
drop policy if exists "members can update leads" on public.leads;
drop policy if exists "admins can delete leads" on public.leads;
drop policy if exists "members can read activity" on public.activity_logs;
drop policy if exists "members can create activity" on public.activity_logs;
create policy "members can read their workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "owners and admins can update workspace" on public.workspaces for update to authenticated using (public.has_workspace_role(id, array['owner','admin'])) with check (public.has_workspace_role(id, array['owner','admin']));
create policy "members can read workspace members" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members can read leads" on public.leads for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members can create leads" on public.leads for insert to authenticated with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));
create policy "members can update leads" on public.leads for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "admins can delete leads" on public.leads for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']));
create policy "members can read activity" on public.activity_logs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members can create activity" on public.activity_logs for insert to authenticated with check (public.is_workspace_member(workspace_id) and (actor_id is null or actor_id = auth.uid()));
-- No end-user policies on integrations, integration_events, or rate-limit rows.
-- The app accesses those tables only through server code using the service-role key.

-- Automatically provision an owner workspace when an Auth user is created.
create or replace function public.handle_new_leadflow_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_slug text;
  v_workspace_id uuid;
  v_type text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'My Business');
  v_type := coalesce(nullif(new.raw_user_meta_data ->> 'business_type', ''), 'other');
  if v_type not in ('landscaping','cleaning','home_repair','tutoring','auto_detailing','pet_care','professional_services','photography','retail','other') then
    v_type := 'other';
  end if;
  v_slug := coalesce(nullif(left(regexp_replace(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), 36), ''), 'business') || '-' || left(new.id::text, 8);
  insert into public.workspaces(name, slug, business_type, created_by, notification_email)
  values (left(v_name, 90), v_slug, v_type, new.id, new.email)
  returning id into v_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_leadflow on auth.users;
create trigger on_auth_user_created_leadflow
  after insert on auth.users
  for each row execute procedure public.handle_new_leadflow_user();

-- The only anonymous write path: a narrowly scoped function for a public website form.
create or replace function public.create_public_lead(
  p_slug text,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_offering text,
  p_location_context text,
  p_notes text,
  p_ip_hash text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_workspace public.workspaces%rowtype;
  v_hits integer;
  v_lead_id uuid;
  v_bucket timestamptz := date_trunc('minute', now());
begin
  if p_ip_hash is null or char_length(p_ip_hash) <> 64 then raise exception 'Invalid request'; end if;
  if p_customer_name is null or char_length(trim(p_customer_name)) < 2 or char_length(p_customer_name) > 90 then raise exception 'Invalid request'; end if;
  if p_offering is null or char_length(trim(p_offering)) < 1 or char_length(p_offering) > 120 then raise exception 'Invalid request'; end if;
  if p_notes is not null and char_length(p_notes) > 1500 then raise exception 'Invalid request'; end if;
  if p_email is null or char_length(p_email) > 120 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid request'; end if;
  if p_phone is not null and char_length(p_phone) > 30 then raise exception 'Invalid request'; end if;
  if p_location_context is not null and char_length(p_location_context) > 160 then raise exception 'Invalid request'; end if;

  delete from public.public_intake_rate_limits where bucket_start < now() - interval '1 day';

  insert into public.public_intake_rate_limits(ip_hash, bucket_start, hits)
  values (p_ip_hash, v_bucket, 1)
  on conflict (ip_hash, bucket_start) do update set hits = public.public_intake_rate_limits.hits + 1
  returning hits into v_hits;
  if v_hits > 5 then raise exception 'Rate limit exceeded'; end if;

  select * into v_workspace from public.workspaces where slug = p_slug and public_intake_enabled = true limit 1;
  if not found then raise exception 'Intake not available'; end if;

  insert into public.leads(workspace_id, customer_name, email, phone, offering, location_context, source, status, notes, contact_permission)
  values (v_workspace.id, trim(p_customer_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), trim(p_offering), nullif(trim(p_location_context), ''), 'Website', 'new', nullif(trim(p_notes), ''), true)
  returning id into v_lead_id;
  return v_lead_id;
end;
$$;

revoke all on function public.create_public_lead(text,text,text,text,text,text,text,text) from public;
revoke all on function public.create_public_lead(text,text,text,text,text,text,text,text) from anon, authenticated;
grant execute on function public.create_public_lead(text,text,text,text,text,text,text,text) to service_role;
