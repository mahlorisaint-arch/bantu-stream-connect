-- Applied live via Supabase MCP. Record only.
--
-- The copyright_reports table (and its public takedown-request form on
-- copyright-policy.html) already existed and worked, but had exactly one
-- RLS policy: anon INSERT. Nothing - not even an admin - could ever read
-- a submitted report back out. This migration:
--   1. Adds admin SELECT/UPDATE policies, mirroring the existing
--      comment_reports_admin_* pattern (checks user_profiles.role='admin').
--   2. Adds a pg_net trigger that emails support@bantustreamconnect.com via
--      the new notify-copyright-report Edge Function whenever a report is
--      submitted, so it doesn't sit invisible until someone thinks to check.
--
-- The Authorization header below carries the Supabase anon key, not a
-- secret - it's the same publishable key already embedded in every page's
-- client-side JS (see copyright-policy.html). It only proves "this request
-- has a valid Supabase JWT" (the Edge Function has verify_jwt=true); it
-- carries no special privilege. This is the same pattern already used by
-- trigger_sync_resend_contact - not a repeat of the earlier webhook-secret
-- leak, which was a genuine service-role-equivalent shared secret.

create policy copyright_reports_admin_select on public.copyright_reports
  for select
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_profiles.id = (select auth.uid())
      and user_profiles.role = 'admin'
  ));

create policy copyright_reports_admin_update on public.copyright_reports
  for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_profiles.id = (select auth.uid())
      and user_profiles.role = 'admin'
  ));

create or replace function public.trigger_notify_copyright_report()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ydnxqnbjoshvxteevemc.supabase.co/functions/v1/notify-copyright-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'copyright_reports', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_copyright_report on public.copyright_reports;
create trigger trg_notify_copyright_report
after insert on public.copyright_reports
for each row execute function public.trigger_notify_copyright_report();

-- One-off, not re-runnable: grants the platform owner's own account admin
-- access so copyright reports (and existing comment_reports) can actually
-- be reviewed. Applied directly, not repeated here as a statement, since
-- re-running an UPDATE by id is a data migration, not schema.
-- (mahlorisaint@gmail.com -> role='admin')
