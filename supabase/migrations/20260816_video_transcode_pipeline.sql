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

create or replace function public.trigger_video_transcode()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.media_type = 'video' and new.streaming_provider = 'pending_transcode' then
    perform net.http_post(
      url := 'https://transcoder.bantustreamconnect.com/transcode',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'cc306f0c1bbacf2e85c42f150d7ed7035414a182a593589c0aa19237318a7b1d'
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
