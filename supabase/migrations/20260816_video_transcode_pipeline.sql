-- Adds processing-status tracking (never existed before - the app
-- previously just assumed a video was watchable immediately after upload,
-- relying on Cloudflare Stream's near-instant readiness) and a trigger
-- that fires the self-hosted transcoder worker whenever a new video is
-- uploaded through the new R2 pipeline. Existing rows default to 'ready'
-- so nothing already-playable is affected.
--
-- Applied live via Supabase MCP. CREATE OR REPLACE is safe to rerun; the
-- ALTER TABLE / constraint statements are not.

alter table "Content"
  add column if not exists processing_status text not null default 'ready';

alter table "Content" drop constraint if exists content_processing_status_check;
alter table "Content" add constraint content_processing_status_check
  check (processing_status in ('queued', 'ready', 'failed'));

create extension if not exists pg_net with schema extensions;

-- SECURITY NOTE: an earlier version of this function hardcoded the webhook
-- secret directly here. That got pushed to this public repo and was
-- flagged by GitGuardian - the secret has since been rotated (the leaked
-- value is dead) and moved into Supabase Vault, read at call time instead
-- of ever being written in plaintext again. See
-- supabase/migrations/20260816b_fix_leaked_webhook_secret.sql.
create or replace function public.trigger_video_transcode()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_webhook_secret text;
begin
  if new.media_type = 'video' and new.streaming_provider = 'pending_transcode' then
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'transcoder_webhook_secret';

    perform net.http_post(
      url := 'https://transcoder.bantustreamconnect.com/transcode',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object('type', 'INSERT', 'table', 'Content', 'record', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_video_transcode on "Content";
create trigger trg_video_transcode
after insert on "Content"
for each row execute function public.trigger_video_transcode();
