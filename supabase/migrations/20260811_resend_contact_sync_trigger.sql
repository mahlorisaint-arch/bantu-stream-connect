-- Fires the sync-resend-contact Edge Function on every new user_profiles row,
-- so new signups land in the Resend "All contacts" audience without a manual
-- CSV re-export. Uses pg_net directly (same mechanism Supabase's Database
-- Webhooks UI wraps) since that UI wasn't available in this project's
-- dashboard. Authorization uses the public anon key, already embedded
-- client-side in js/home-feed.js etc. - it only needs to pass the Edge
-- Function's own JWT gate; the function itself uses its auto-injected
-- SUPABASE_SERVICE_ROLE_KEY for the privileged auth.admin lookup.

create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_sync_resend_contact()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ydnxqnbjoshvxteevemc.supabase.co/functions/v1/sync-resend-contact',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'user_profiles', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_resend_contact on public.user_profiles;
create trigger trg_sync_resend_contact
after insert on public.user_profiles
for each row execute function public.trigger_sync_resend_contact();
