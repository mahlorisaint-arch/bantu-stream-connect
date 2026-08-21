-- Applied live via Supabase MCP. Record only.
--
-- content_reports (the "Report" action on Content Detail/Shorts Detail)
-- had the exact same gap copyright_reports had before
-- 20260819_copyright_reports_admin_and_notify.sql: anon/authenticated
-- could INSERT and read back their OWN report, but nothing ever notified
-- anyone a report existed, and there was no admin read/update path at
-- all. This migration:
--   1. Adds admin SELECT/UPDATE policies, same comment_reports_admin_*/
--      copyright_reports_admin_* pattern (checks user_profiles.role='admin').
--   2. Adds a pg_net trigger that emails support@bantustreamconnect.com via
--      the new notify-content-report Edge Function whenever a report is
--      submitted.
--
-- Unlike copyright_reports' public anonymous form (full human-readable
-- fields already on the row), content_reports only ever stores foreign
-- keys (reporter_id, content_id, reported_user_id) - notify-content-report
-- enriches those with the actual content title and reporter/reported
-- username via a service-role lookup before emailing.
--
-- The Authorization header below carries the Supabase anon key, not a
-- secret - same as the copyright_reports trigger; see that migration's
-- comment for the full explanation.
--
-- Verified end-to-end with a real test INSERT before this record was
-- written: net._http_response showed status_code=200/"OK" for the
-- notify-content-report call, confirming the email actually sent via
-- Resend, not just that the trigger fired.

create policy content_reports_admin_select on public.content_reports
  for select
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_profiles.id = (select auth.uid())
      and user_profiles.role = 'admin'
  ));

create policy content_reports_admin_update on public.content_reports
  for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_profiles.id = (select auth.uid())
      and user_profiles.role = 'admin'
  ));

create or replace function public.trigger_notify_content_report()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ydnxqnbjoshvxteevemc.supabase.co/functions/v1/notify-content-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'content_reports', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_content_report on public.content_reports;
create trigger trg_notify_content_report
after insert on public.content_reports
for each row execute function public.trigger_notify_content_report();
