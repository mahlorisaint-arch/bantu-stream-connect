-- Fixes a real secret leak: the transcoder webhook secret was hardcoded
-- directly in 20260816_video_transcode_pipeline.sql, which is tracked in
-- this PUBLIC GitHub repo and got flagged by GitGuardian. Rotates the
-- secret and moves it into Supabase Vault instead of ever hardcoding it in
-- SQL again.
--
-- The actual secret value is deliberately NOT written here - this repo is
-- public, and writing the new value in plaintext would just recreate the
-- exact same leak with a fresh secret. It was set directly via the
-- Supabase SQL Editor / MCP tool at apply time and lives only in Vault and
-- the transcoder server's own .env - this file is a record of the
-- structure applied, not a literal replay script.

select vault.create_secret(
  '<redacted - generated with `openssl rand -hex 32`, set directly via Supabase dashboard/MCP, never committed>',
  'transcoder_webhook_secret',
  'Shared secret for authenticating calls to the video transcoder worker''s /transcode endpoint'
);

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
