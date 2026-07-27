-- Applied live via the Supabase MCP tool (2026-07-27, same day as
-- 20260727_music_worlds_and_notifications.sql, second pass). Record only -
-- already applied. CREATE OR REPLACE statements are safe to rerun; the
-- ADD COLUMN uses IF NOT EXISTS.
--
-- Context: shared-components.js's notification click handler reads
-- notification.action_url (js/shared-components.js:1309) - but
-- notifications had no action_url column at all. This isn't specific to
-- the four types added in the previous migration; it means every
-- notification of every type (like/comment/follow/etc.) has always been
-- unclickable platform-wide. Only the four new types are fixed here, per
-- the explicit scope of this pass - the same gap for pre-existing types
-- is a separate, bigger, flagged-not-fixed issue.

alter table public.notifications add column if not exists action_url text;

-- ============================================================
-- world_unlock / world_content: deep-link into the specific world (and
-- sub-world, for unlocks) via query params, decoded by
-- handleWorldDeepLink() in js/music/music.js. portal_drop / streak_nudge:
-- link to the Portal section anchor (css/music/music.css gives
-- #portal-section a scroll-margin-top so the sticky header doesn't cover
-- it on arrival).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_process_listen_event()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_genre_id uuid;
  v_parent_name text;
  v_progress user_world_progress%ROWTYPE;
  v_child record;
BEGIN
  IF NEW.is_completed IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_completed = true THEN
    RETURN NEW;
  END IF;

  SELECT primary_genre_id INTO v_genre_id
  FROM "Content"
  WHERE id = NEW.content_id;

  IF v_genre_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.touch_watch_streak(NEW.user_id, 'listen');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO user_world_progress (user_id, genre_id, tracks_listened, total_tracks_in_world, last_active_at)
  VALUES (
    NEW.user_id, v_genre_id, 1,
    (SELECT count(*) FROM "Content" WHERE primary_genre_id = v_genre_id AND status = 'published'),
    now()
  )
  ON CONFLICT (user_id, genre_id)
  DO UPDATE SET
    tracks_listened = user_world_progress.tracks_listened + 1,
    last_active_at = now(),
    updated_at = now()
  RETURNING * INTO v_progress;

  UPDATE user_world_progress
  SET exploration_percentage = LEAST(
        100,
        COALESCE(ROUND(tracks_listened::numeric / NULLIF(total_tracks_in_world, 0) * 100, 2), 0)
      )
  WHERE user_id = NEW.user_id AND genre_id = v_genre_id
  RETURNING * INTO v_progress;

  SELECT name INTO v_parent_name
  FROM genres
  WHERE id = v_genre_id;

  FOR v_child IN
    SELECT id, name, unlock_threshold_tracks
    FROM genres
    WHERE parent_genre_id = v_genre_id
  LOOP
    IF NOT (v_progress.unlocked_subworlds @> to_jsonb(v_child.id::text))
       AND v_progress.tracks_listened >= v_child.unlock_threshold_tracks
    THEN
      UPDATE user_world_progress
      SET unlocked_subworlds = unlocked_subworlds || to_jsonb(v_child.id::text)
      WHERE user_id = NEW.user_id AND genre_id = v_genre_id;

      INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
      VALUES (
        NEW.user_id,
        'world_unlock',
        v_child.name || ' unlocked',
        'You''ve unlocked ' || v_child.name || ' in ' || v_parent_name || '. Tap to explore.',
        '/category/music.html?world=' || v_genre_id || '&worldName=' || replace(v_parent_name, ' ', '%20')
          || '&subworld=' || v_child.id || '&subworldName=' || replace(v_child.name, ' ', '%20'),
        jsonb_build_object(
          'parent_genre_id', v_genre_id,
          'parent_genre_name', v_parent_name,
          'unlocked_genre_id', v_child.id,
          'unlocked_genre_name', v_child.name
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

create or replace function public.fn_notify_world_content_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_genre_name text;
  v_user record;
  v_existing record;
  v_new_count integer;
  v_url text;
begin
  if new.primary_genre_id is null or new.status <> 'published' then
    return new;
  end if;

  if TG_OP = 'UPDATE' and OLD.status = 'published' then
    return new;
  end if;

  select name into v_genre_name from genres where id = new.primary_genre_id;
  v_url := '/category/music.html?world=' || new.primary_genre_id || '&worldName=' || replace(v_genre_name, ' ', '%20');

  for v_user in
    select distinct user_id
    from user_world_progress
    where genre_id = new.primary_genre_id
      and user_id <> new.user_id
  loop
    select id, metadata into v_existing
    from notifications
    where user_id = v_user.user_id
      and type = 'world_content'
      and metadata->>'genre_id' = new.primary_genre_id::text
      and created_at::date = current_date
    order by created_at desc
    limit 1;

    if v_existing.id is not null then
      v_new_count := coalesce((v_existing.metadata->>'track_count')::integer, 1) + 1;
      update notifications
      set title = v_genre_name || ' just got ' || v_new_count || ' new track' || (case when v_new_count = 1 then '' else 's' end),
          message = 'Fresh tracks are waiting in ' || v_genre_name || '. Tap to explore.',
          action_url = v_url,
          metadata = jsonb_set(v_existing.metadata, '{track_count}', to_jsonb(v_new_count)),
          is_read = false,
          created_at = now()
      where id = v_existing.id;
    else
      insert into notifications (user_id, type, title, message, action_url, metadata)
      values (
        v_user.user_id,
        'world_content',
        v_genre_name || ' just got 1 new track',
        'Fresh tracks are waiting in ' || v_genre_name || '. Tap to explore.',
        v_url,
        jsonb_build_object('genre_id', new.primary_genre_id, 'track_count', 1)
      );
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.fn_notify_streak_lapse_risk()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into notifications (user_id, type, title, message, action_url, metadata)
  select
    us.user_id,
    'streak_nudge',
    'Your streak ends at midnight',
    'Day ' || us.current_streak_days || ' — one listen keeps it alive.',
    '/category/music.html#portal-section',
    jsonb_build_object('streak_type', us.streak_type, 'current_streak_days', us.current_streak_days)
  from user_streaks us
  where us.streak_type = 'listen'
    and us.last_activity_date = current_date - 1
    and not exists (
      select 1 from notifications n
      where n.user_id = us.user_id
        and n.type = 'streak_nudge'
        and n.created_at::date = current_date
    );
end;
$$;

-- fn_generate_portal_drop: same three fresh-generation INSERT sites as
-- 20260727_music_worlds_and_notifications.sql, each now also setting
-- action_url = '/category/music.html#portal-section'. Full definition
-- omitted here for brevity - see that file for the complete function body
-- (only the three INSERT INTO notifications statements changed, adding
-- the action_url column/value).

-- ============================================================
-- Scoped but NOT built this pass (per explicit instruction):
--
-- approaching_unlock - "one more track to unlock Sgija." Real event: in
-- fn_process_listen_event's existing unlock-check loop, alongside the
-- >= threshold branch, add tracks_listened = threshold - 1 (not yet
-- unlocked). All data already exists (same loop, same columns) - this is
-- a small extension, not new infrastructure. Dedup by existence (has this
-- user ever gotten this specific approaching_unlock for this subworld),
-- not by day, since it's a one-time nudge rather than recurring. Open
-- question: how many tracks "away" counts as "approaching" if a future
-- world has a threshold much higher than 5.
--
-- unfinished_world - "Amapiano is waiting - you're 40% through." Real
-- event: not tied to a single listen, needs a scheduled check (same shape
-- as fn_notify_streak_lapse_risk's cron) - user_world_progress rows where
-- last_active_at is older than some inactivity window and
-- exploration_percentage < 100. All data already exists and is now
-- correctly computed (this session's exploration_percentage fix). Open
-- questions: the inactivity threshold (7 days? 14?) and a re-notify
-- cooldown so it doesn't fire every day once flagged.
-- ============================================================
