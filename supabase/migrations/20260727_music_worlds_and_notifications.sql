-- Applied live via the Supabase MCP tool during the Music Discovery audit +
-- fix pass (2026-07-27). This file is a record of what was changed and
-- why, not something that still needs running - re-running the CREATE
-- FUNCTION statements is safe (all CREATE OR REPLACE), but the ALTER TABLE
-- constraint changes will error if run twice (drop-then-add against a
-- constraint that's already been replaced) - check current state first if
-- you ever need to reapply.
--
-- Context: the Music Discovery audit found fn_process_listen_event (a
-- correct, working trigger on watch_progress) had never actually fired for
-- anyone, because it exits immediately when a track has no
-- Content.primary_genre_id - which was true for every track, since the
-- upload flow had no genre field until this same session added one. Once
-- genre tagging went live, this trigger reactivated - and while wiring
-- Music's streak counter onto the same real backend system Home Feed uses
-- (per user_streaks/touch_watch_streak, see 20260726_user_streaks.sql),
-- it turned out that migration's own CREATE TABLE had never actually run
-- either: public.user_streaks in production is an older, differently-
-- shaped table (streak_type constrained to watch/upload/comment/share, a
-- milestones_achieved column, no created_at) that the home-feed audit
-- missed, and touch_watch_streak() didn't exist in the live database at
-- all - so Home's own streak banner had been silently dark too, this
-- whole time, for an unrelated reason to anything Music-specific.

-- ============================================================
-- 1. Repair touch_watch_streak() - add the streak_type it was always
--    missing from the live database, generalized to accept a type
--    (default 'watch', so the existing call in js/supabase-helper.js's
--    recordContentView() - which only ever passes p_user_id - keeps
--    working unchanged). Music's listen completions now call this with
--    'listen' explicitly, from fn_process_listen_event below.
-- ============================================================
create or replace function public.touch_watch_streak(p_user_id uuid, p_streak_type text default 'watch')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_date date;
  v_current integer;
  v_longest integer;
begin
  select last_activity_date, current_streak_days, longest_streak_days
    into v_last_date, v_current, v_longest
  from public.user_streaks
  where user_id = p_user_id and streak_type = p_streak_type
  for update;

  if not found then
    insert into public.user_streaks (user_id, streak_type, current_streak_days, longest_streak_days, last_activity_date)
    values (p_user_id, p_streak_type, 1, 1, current_date);
    return;
  end if;

  if v_last_date = current_date then
    return;
  elsif v_last_date = current_date - 1 then
    v_current := v_current + 1;
  else
    v_current := 1;
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.user_streaks
  set current_streak_days = v_current,
      longest_streak_days = v_longest,
      last_activity_date = current_date,
      updated_at = now()
  where user_id = p_user_id and streak_type = p_streak_type;
end;
$$;

grant execute on function public.touch_watch_streak(uuid, text) to authenticated;

-- Widen the live streak_type check constraint (previously watch/upload/
-- comment/share only) to allow 'listen'.
alter table public.user_streaks drop constraint if exists user_streaks_streak_type_check;
alter table public.user_streaks add constraint user_streaks_streak_type_check
  check (streak_type = any (array['watch','upload','comment','share','listen']));

-- Widen the live notifications type check constraint to add
-- 'world_content' (used by fn_notify_world_content_added below).
-- world_unlock, portal_drop, streak_nudge were already allowed - a
-- pre-planned taxonomy that, before this pass, nothing ever actually
-- wrote to. approaching_unlock and unfinished_world are also already
-- allowed and still unused - real opportunities for a future pass, not
-- built here.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'like','comment','follow','view_milestone','upload_processed','playlist_added',
    'creator_verified','system','world_unlock','portal_drop','approaching_unlock',
    'streak_nudge','unfinished_world','world_content'
  ]));

-- ============================================================
-- 2. fn_process_listen_event - touch the real 'listen' streak on the same
--    signal that already drives world-progress/unlock, and fix a real bug
--    in the exploration_percentage calc: LEAST() ignores NULL arguments in
--    Postgres rather than propagating it, so LEAST(100, NULL) silently
--    returned 100 whenever total_tracks_in_world was 0/unset - a brand
--    new listener read as "100% explored" instead of an honest 0%. Also
--    seeds total_tracks_in_world with a real count at insert time instead
--    of leaving it at 0 until the next publish-triggered refresh.
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

      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        NEW.user_id,
        'world_unlock',
        v_child.name || ' unlocked',
        'You''ve unlocked ' || v_child.name || ' in ' || v_parent_name || '. Tap to explore.',
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

-- ============================================================
-- 3. World size correctness - fn_refresh_world_track_counts() already
--    existed (recalculates total_tracks_in_world per genre) but nothing
--    ever called it: no trigger, no cron schedule. Ran once to fix
--    existing rows, then wired to fire automatically whenever content is
--    published or re-tagged, rather than a polling cron delay.
-- ============================================================
select public.fn_refresh_world_track_counts();

create or replace function public.fn_trg_refresh_world_track_counts()
returns trigger
language plpgsql
as $$
begin
  perform public.fn_refresh_world_track_counts();
  return null;
end;
$$;

drop trigger if exists trg_refresh_world_track_counts on "Content";
create trigger trg_refresh_world_track_counts
  after insert or update of primary_genre_id, status on "Content"
  for each row
  when (new.primary_genre_id is not null and new.status = 'published')
  execute function public.fn_trg_refresh_world_track_counts();

-- ============================================================
-- 4. Portal Drop ready notification - insert a real notification the
--    first time a drop is generated for a given day (every branch that
--    actually generates fresh content, not the cache-hit re-read at the
--    top of the function).
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_generate_portal_drop(p_user_id uuid)
 RETURNS TABLE(content_id bigint, source_type text, curator_note text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing record;
  v_dna jsonb;
  v_top_genre uuid;
  v_listen_count integer;
  v_roll numeric;
  v_content_id bigint;
  v_content_title text;
  v_source text;
  v_note text;
  v_mood_word text;
BEGIN
  SELECT * INTO v_existing
  FROM user_portal_drops
  WHERE user_id = p_user_id AND drop_date = current_date;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.content_id, v_existing.source_type, v_existing.curator_note;
    RETURN;
  END IF;

  SELECT sonic_dna INTO v_dna
  FROM user_profiles
  WHERE id = p_user_id;

  SELECT id INTO v_top_genre
  FROM genres
  WHERE name = (v_dna->'top_genres'->0->>'name')
  LIMIT 1;

  SELECT count(*) INTO v_listen_count
  FROM watch_progress
  WHERE user_id = p_user_id AND is_completed = true;

  v_roll := random();

  IF v_listen_count < 10 OR v_top_genre IS NULL THEN
    v_source := 'cold_start';
  ELSIF v_roll < 0.20 THEN
    v_source := 'wildcard';
  ELSE
    v_source := 'adjacent_edge';
  END IF;

  IF v_source IN ('cold_start', 'wildcard') THEN
    SELECT c.id INTO v_content_id
    FROM "Content" c
    WHERE c.is_wildcard_eligible = true
      AND c.status = 'published'
      AND c.id NOT IN (
        SELECT upd.content_id
        FROM user_portal_drops upd
        WHERE upd.user_id = p_user_id
          AND upd.drop_date > current_date - INTERVAL '60 days'
          AND upd.content_id IS NOT NULL
      )
    ORDER BY random()
    LIMIT 1;
  ELSE
    SELECT c.id INTO v_content_id
    FROM "Content" c
    WHERE c.primary_genre_id = v_top_genre
      AND (c.is_unreleased = true OR 'underground' = ANY(c.tags))
      AND c.status = 'published'
      AND c.id NOT IN (
        SELECT upd.content_id
        FROM user_portal_drops upd
        WHERE upd.user_id = p_user_id
          AND upd.drop_date > current_date - INTERVAL '60 days'
          AND upd.content_id IS NOT NULL
      )
    ORDER BY random()
    LIMIT 1;

    IF v_content_id IS NULL THEN
      v_source := 'wildcard';
      SELECT c.id INTO v_content_id
      FROM "Content" c
      WHERE c.is_wildcard_eligible = true
        AND c.status = 'published'
        AND c.id NOT IN (
          SELECT upd.content_id
          FROM user_portal_drops upd
          WHERE upd.user_id = p_user_id
            AND upd.drop_date > current_date - INTERVAL '60 days'
            AND upd.content_id IS NOT NULL
        )
      ORDER BY random()
      LIMIT 1;

      IF v_content_id IS NOT NULL THEN
        INSERT INTO user_portal_drops (
          user_id, drop_date, content_id, source_type, curator_note, fallback_reason
        )
        VALUES (
          p_user_id,
          current_date,
          v_content_id,
          v_source,
          'Something outside your usual orbit. Unreleased.',
          'exhaustion'
        );

        SELECT title INTO v_content_title FROM "Content" WHERE id = v_content_id;
        INSERT INTO notifications (user_id, type, title, message, metadata)
        VALUES (
          p_user_id, 'portal_drop', 'Today''s Portal is ready',
          'A new mystery drop is waiting: ' || COALESCE(v_content_title, 'a track outside your usual orbit') || '.',
          jsonb_build_object('content_id', v_content_id, 'source_type', v_source)
        );

        RETURN QUERY SELECT v_content_id, v_source, 'Something outside your usual orbit. Unreleased.';
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Wildcard-eligible pool exhaustion: once nothing fresh remains within
  -- the 60-day cooldown, replay the pool ignoring the cooldown instead of
  -- returning nothing (see the Portal Drop fix earlier this session).
  IF v_content_id IS NULL THEN
    v_source := 'wildcard';
    SELECT c.id INTO v_content_id
    FROM "Content" c
    WHERE c.is_wildcard_eligible = true
      AND c.status = 'published'
    ORDER BY random()
    LIMIT 1;

    IF v_content_id IS NOT NULL THEN
      INSERT INTO user_portal_drops (
        user_id, drop_date, content_id, source_type, curator_note, fallback_reason
      )
      VALUES (
        p_user_id,
        current_date,
        v_content_id,
        v_source,
        'A favorite worth another spin.',
        'pool_exhausted'
      );

      SELECT title INTO v_content_title FROM "Content" WHERE id = v_content_id;
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        p_user_id, 'portal_drop', 'Today''s Portal is ready',
        'A favorite worth another spin: ' || COALESCE(v_content_title, 'your Portal pick') || '.',
        jsonb_build_object('content_id', v_content_id, 'source_type', v_source)
      );

      RETURN QUERY SELECT v_content_id, v_source, 'A favorite worth another spin.';
      RETURN;
    END IF;
  END IF;

  IF v_content_id IS NULL THEN
    RETURN;
  END IF;

  SELECT key INTO v_mood_word
  FROM jsonb_each_text(COALESCE(v_dna->'mood_weights', '{}'::jsonb))
  ORDER BY value::numeric DESC
  LIMIT 1;

  v_note := CASE
    WHEN v_source = 'cold_start' THEN 'Finding your first sound. Tap in.'
    WHEN v_source = 'wildcard' THEN 'Something outside your usual orbit. Unreleased.'
    ELSE 'A ' || COALESCE(v_mood_word, 'late-night') || ' find, close to what you already love.'
  END;

  INSERT INTO user_portal_drops (
    user_id, drop_date, content_id, source_type, curator_note
  )
  VALUES (p_user_id, current_date, v_content_id, v_source, v_note);

  SELECT title INTO v_content_title FROM "Content" WHERE id = v_content_id;
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id, 'portal_drop', 'Today''s Portal is ready',
    v_note || ' ' || COALESCE(v_content_title, ''),
    jsonb_build_object('content_id', v_content_id, 'source_type', v_source)
  );

  RETURN QUERY SELECT v_content_id, v_source, v_note;
END;
$function$;

-- ============================================================
-- 5. Streak-lapse warning - evening cron check. Only targets users whose
--    listen streak is genuinely one day from lapsing (listened yesterday,
--    not yet today) - a streak that broke 2+ days ago just hasn't been
--    reset in storage yet, and warning "ends tonight" for that case would
--    be false. Deduped per user per day.
-- ============================================================
create or replace function public.fn_notify_streak_lapse_risk()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into notifications (user_id, type, title, message, metadata)
  select
    us.user_id,
    'streak_nudge',
    'Your streak ends at midnight',
    'Day ' || us.current_streak_days || ' — one listen keeps it alive.',
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

grant execute on function public.fn_notify_streak_lapse_risk() to service_role;

select cron.schedule(
  'notify-streak-lapse-risk',
  '0 19 * * *',
  $$select public.fn_notify_streak_lapse_risk();$$
);

-- ============================================================
-- 6. New content in explored worlds - digest per (user, genre, day)
--    rather than one notification per track, so a creator publishing
--    several tracks the same day doesn't spam their own listeners. Only
--    notifies users who already have real progress in that genre
--    (user_world_progress), and never the uploader about their own track.
-- ============================================================
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
begin
  if new.primary_genre_id is null or new.status <> 'published' then
    return new;
  end if;

  if TG_OP = 'UPDATE' and OLD.status = 'published' then
    return new;
  end if;

  select name into v_genre_name from genres where id = new.primary_genre_id;

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
          metadata = jsonb_set(v_existing.metadata, '{track_count}', to_jsonb(v_new_count)),
          is_read = false,
          created_at = now()
      where id = v_existing.id;
    else
      insert into notifications (user_id, type, title, message, metadata)
      values (
        v_user.user_id,
        'world_content',
        v_genre_name || ' just got 1 new track',
        'Fresh tracks are waiting in ' || v_genre_name || '. Tap to explore.',
        jsonb_build_object('genre_id', new.primary_genre_id, 'track_count', 1)
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_world_content_added on "Content";
create trigger trg_notify_world_content_added
  after insert or update of primary_genre_id, status on "Content"
  for each row
  when (new.primary_genre_id is not null and new.status = 'published')
  execute function public.fn_notify_world_content_added();

-- ============================================================
-- Not built in this pass, deliberately: real device-level push delivery.
-- sw.js already has a working push receiver
-- (self.addEventListener('push', ...)) but nothing subscribes a device to
-- it - no pushManager.subscribe(), no VAPID key, no subscription storage,
-- no server-side sender. All the notifications above land in the existing
-- in-app bell (shared-components.js), which is real and fully working.
-- Push is a separate infrastructure project, scoped out per the audit.
-- ============================================================
