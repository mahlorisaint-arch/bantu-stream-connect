-- Applied live via Supabase MCP. Record only.
--
-- Self-built, admin-only monitoring: screen/page views + error logs, for
-- both the mobile app and web. The team had zero visibility into what's
-- happening in the live apps before this - no analytics events, no error
-- reporting anywhere on either platform.
--
-- Deliberately separate from content_events - that table is content-
-- engagement-specific (feeds the momentum/trending algorithm) and now has
-- a short 3-day retention job, which would be wrong for data meant to
-- accumulate for analytics.

create table public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'screen_view',
  screen_name text,
  platform text not null,
  app_version text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index app_events_created_at_idx on public.app_events (created_at desc);
create index app_events_screen_name_idx on public.app_events (screen_name);

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  error_message text not null,
  stack_trace text,
  screen_name text,
  app_version text,
  device_info jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index app_errors_created_at_idx on public.app_errors (created_at desc);

alter table public.app_events enable row level security;
alter table public.app_errors enable row level security;

-- Insert open to anyone (including guests - unauthenticated usage/errors
-- still matter), same shape as content_reports' public insert policy.
create policy app_events_insert on public.app_events
  for insert
  to anon, authenticated
  with check (true);

create policy app_errors_insert on public.app_errors
  for insert
  to anon, authenticated
  with check (true);

-- Read restricted to admins only, exact same pattern as
-- content_reports_admin_select / copyright_reports_admin_select.
create policy app_events_admin_select on public.app_events
  for select
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_profiles.id = (select auth.uid())
      and user_profiles.role = 'admin'
  ));

create policy app_errors_admin_select on public.app_errors
  for select
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_profiles.id = (select auth.uid())
      and user_profiles.role = 'admin'
  ));
