-- Applied live via the Supabase MCP tool (2026-08-08). Record only -
-- already applied. CREATE OR REPLACE statements are safe to rerun; the
-- ALTER TABLE constraint change will error if run twice (drop-then-add
-- against a constraint that's already been replaced) - check current
-- state first if you ever need to reapply.
--
-- Context: 6 new notification types, each carrying a plain English
-- version and a "local flavor" South African English vernacular version
-- (Yebo, Siyabonga, Dala what you must, Siya La) for genuinely earned,
-- rare, emotional moments only (first upload, big milestones,
-- anniversary) - not everyday notifications. The flavor branch is gated
-- on user_profiles.preferred_languages being non-empty (the user has set
-- ANY of the 11 SA language options, not a specific-language match -
-- these are widely-understood SA English loanwords, not indigenous-
-- language translation) - empty/unset always renders plain. No inline
-- translation is ever added alongside the flavored copy.
--
-- Also fixes a real live bug found while touching notifications_type_check:
-- 'resume_reminder' has been inserted by send_resume_watching_reminders()
-- since it was deployed, but was never actually in the allowed-values
-- list - every cron run since has been silently failing that INSERT.

-- ============================================================
-- 0. Widen notifications_type_check for the 6 new types + the
--    resume_reminder bug fix.
-- ============================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'like','comment','follow','view_milestone','upload_processed','playlist_added',
    'creator_verified','system','world_unlock','portal_drop','approaching_unlock',
    'streak_nudge','unfinished_world','world_content','creator_upload','collab_response',
    'collab_message','resume_reminder',
    'welcome_signup','first_upload','upload_milestone_100','signup_anniversary',
    'streak_milestone','first_engagement'
  ]));

-- ============================================================
-- 1. welcome_signup - extends handle_new_creator() (the live
--    on_auth_user_created trigger on auth.users), inserting one
--    notification right after the existing user_profiles/creators
--    inserts. preferred_languages is always '{}' at this exact instant
--    (the INSERT above never sets it, so the flavor check is real but
--    will realistically always evaluate false today - kept as a real
--    check rather than hardcoded, so this self-corrects if the signup
--    flow ever changes to collect a language preference upfront).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_creator()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    generated_username TEXT;
    generated_full_name TEXT;
    v_flavor boolean;
BEGIN

    generated_full_name :=
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        );

    generated_username :=
        LOWER(
            REGEXP_REPLACE(
                COALESCE(
                    NEW.raw_user_meta_data->>'username',
                    split_part(NEW.email, '@', 1)
                ),
                '[^a-zA-Z0-9_]',
                '',
                'g'
            )
        );

    generated_username :=
        generated_username || '_' || LEFT(NEW.id::text, 8);

    ----------------------------------------------------------------
    -- USER PROFILE
    ----------------------------------------------------------------

    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        username,
        role
    )
    VALUES (
        NEW.id,
        NEW.email,
        generated_full_name,
        generated_username,
        'creator'
    )
    ON CONFLICT (id) DO NOTHING;

    ----------------------------------------------------------------
    -- CREATOR
    ----------------------------------------------------------------

    INSERT INTO public.creators (
        id,
        email,
        auth_uid,
        username
    )
    VALUES (
        NEW.id,
        NEW.email,
        NEW.id::text,
        generated_username
    )
    ON CONFLICT (id) DO NOTHING;

    ----------------------------------------------------------------
    -- WELCOME NOTIFICATION
    ----------------------------------------------------------------

    SELECT coalesce(array_length(preferred_languages,1),0) > 0 INTO v_flavor
    FROM public.user_profiles WHERE id = NEW.id;

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        NEW.id,
        'welcome_signup',
        CASE WHEN v_flavor THEN 'Yebo, ' || generated_full_name || '!' ELSE 'Welcome to Bantu Stream Connect' END,
        CASE WHEN v_flavor THEN 'Welcome to Bantu Stream Connect. No DNA, just RSA.'
             ELSE 'Welcome to Bantu Stream Connect, ' || generated_full_name || '.' END
    );

    RETURN NEW;

END;
$function$;

-- ============================================================
-- 2. first_upload / upload_milestone_100 - a NEW, separate trigger on
--    "Content" alongside the existing trg_notify_creator_upload (which
--    fans out to subscribers, untouched). This one notifies the creator
--    themselves about their own upload-count milestone. Guard body
--    mirrors fn_notify_creator_upload() exactly so it fires on the
--    identical publish transition.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notify_creator_own_upload_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_flavor boolean;
  v_count integer;
BEGIN
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM "Content"
  WHERE user_id = NEW.user_id AND status = 'published';

  IF v_count <> 1 AND v_count <> 100 THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(full_name, username, 'there'), coalesce(array_length(preferred_languages,1),0) > 0
    INTO v_name, v_flavor
  FROM user_profiles WHERE id = NEW.user_id;

  IF v_count = 1 THEN
    INSERT INTO notifications (user_id, type, title, message, content_id, content_title, content_type, action_url)
    VALUES (
      NEW.user_id, 'first_upload',
      CASE WHEN v_flavor THEN 'Siyabonga, ' || v_name ELSE 'Your first upload is live' END,
      CASE WHEN v_flavor THEN 'Siyabonga for trusting us with your first upload, ' || v_name || '. This is the beginning.'
           ELSE 'Your first upload is live.' END,
      NEW.id, NEW.title, NEW.content_type,
      '/content-detail.html?id=' || NEW.id
    );
  ELSIF v_count = 100 THEN
    INSERT INTO notifications (user_id, type, title, message, action_url)
    VALUES (
      NEW.user_id, 'upload_milestone_100',
      CASE WHEN v_flavor THEN '100 uploads, ' || v_name ELSE '100 uploads, thank you' END,
      CASE WHEN v_flavor THEN 'Siyabonga, you''ve given this platform more than most people ever will.'
           ELSE 'You''ve reached 100 uploads. Thank you.' END,
      '/creator-channel.html?id=' || NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_creator_own_upload_milestones ON "Content";
CREATE TRIGGER trg_notify_creator_own_upload_milestones
  AFTER INSERT OR UPDATE OF status ON "Content"
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_creator_own_upload_milestones();

-- ============================================================
-- 3. signup_anniversary - new scheduled job, same shape as
--    fn_notify_streak_lapse_risk (daily cron, per-user-per-day dedup).
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notify_signup_anniversaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message)
  SELECT
    x.id,
    'signup_anniversary',
    CASE WHEN x.flavor THEN 'One year of Siya La' ELSE 'Happy anniversary!' END,
    CASE WHEN x.flavor THEN 'One year ago today you joined Bantu Stream Connect.'
         ELSE 'One year ago today, you joined Bantu Stream Connect.' END
  FROM (
    SELECT up.id, coalesce(array_length(up.preferred_languages,1),0) > 0 AS flavor
    FROM user_profiles up
    WHERE extract(month FROM up.created_at) = extract(month FROM now())
      AND extract(day FROM up.created_at) = extract(day FROM now())
      AND up.created_at < now() - interval '1 year'
  ) x
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = x.id
      AND n.type = 'signup_anniversary'
      AND n.created_at::date = current_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_notify_signup_anniversaries() TO service_role;

SELECT cron.schedule(
  'notify-signup-anniversaries',
  '0 9 * * *',
  $$SELECT public.fn_notify_signup_anniversaries();$$
);

-- ============================================================
-- 4. streak_milestone - extends touch_watch_streak(), the single real
--    chokepoint for all streak increments. 'watch' streak_type only
--    (the streak surfaced as Home Feed's Streak Banner) - deliberately
--    not applied to 'listen'/other types, to avoid duplicate near-
--    identical notifications landing the same day for a user with
--    multiple active streaks. Dedup via milestones_achieved (confirmed
--    live default '[]'::jsonb, an ARRAY - same @> containment pattern
--    already used for unlocked_subworlds).
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_watch_streak(p_user_id uuid, p_streak_type text DEFAULT 'watch')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date date;
  v_current integer;
  v_longest integer;
  v_milestones jsonb;
  v_milestone_key text;
  v_flavor boolean;
  v_name text;
BEGIN
  SELECT last_activity_date, current_streak_days, longest_streak_days, milestones_achieved
    INTO v_last_date, v_current, v_longest, v_milestones
  FROM public.user_streaks
  WHERE user_id = p_user_id AND streak_type = p_streak_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (user_id, streak_type, current_streak_days, longest_streak_days, last_activity_date)
    VALUES (p_user_id, p_streak_type, 1, 1, current_date);
    RETURN;
  END IF;

  IF v_last_date = current_date THEN
    RETURN;
  ELSIF v_last_date = current_date - 1 THEN
    v_current := v_current + 1;
  ELSE
    v_current := 1;
  END IF;

  v_longest := greatest(v_longest, v_current);

  UPDATE public.user_streaks
  SET current_streak_days = v_current,
      longest_streak_days = v_longest,
      last_activity_date = current_date,
      updated_at = now()
  WHERE user_id = p_user_id AND streak_type = p_streak_type;

  IF p_streak_type = 'watch' AND v_current IN (30, 60, 100) THEN
    v_milestone_key := 'watch:' || v_current;
    IF NOT (coalesce(v_milestones, '[]'::jsonb) @> to_jsonb(v_milestone_key)) THEN
      SELECT coalesce(array_length(preferred_languages,1),0) > 0, coalesce(full_name, username, 'there')
        INTO v_flavor, v_name
      FROM public.user_profiles WHERE id = p_user_id;

      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        p_user_id, 'streak_milestone',
        CASE WHEN v_flavor THEN 'Dala what you must' ELSE v_current || '-day streak' END,
        CASE WHEN v_flavor THEN 'You haven''t missed a day in ' || v_current || '.'
             ELSE 'You''ve kept a ' || v_current || '-day streak going.' END
      );

      UPDATE public.user_streaks
      SET milestones_achieved = coalesce(milestones_achieved, '[]'::jsonb) || to_jsonb(v_milestone_key)
      WHERE user_id = p_user_id AND streak_type = p_streak_type;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_watch_streak(uuid, text) TO authenticated;

-- ============================================================
-- 5. first_engagement - new sibling trigger on content_likes (does NOT
--    modify handle_engagement_notification(), which keeps firing its own
--    generic 'like' notification alongside this one for the same event -
--    intentional, this is an additional celebratory notification for a
--    specific rare moment, not a replacement).
--
--    Deliberately counts content_likes directly (count(*) from
--    content_likes where content_id = ...) rather than reading
--    content_engagement_stats.total_likes - Postgres fires same-event
--    triggers in alphabetical name order, and trg_sync_stats_on_like
--    (which maintains content_engagement_stats) sorts AFTER this new
--    trigger's name alphabetically, so total_likes would still reflect
--    the PRE-increment value if read here. Counting content_likes itself
--    sidesteps that ordering dependency entirely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notify_first_engagement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_like_count integer;
  v_first_content_id bigint;
  v_name text;
  v_flavor boolean;
BEGIN
  SELECT user_id INTO v_owner_id FROM "Content" WHERE id = NEW.content_id;
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_like_count
  FROM content_likes WHERE content_id = NEW.content_id;

  IF v_like_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT min(id) INTO v_first_content_id
  FROM "Content" WHERE user_id = v_owner_id AND status = 'published';

  IF v_first_content_id IS DISTINCT FROM NEW.content_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(full_name, username, 'there'), coalesce(array_length(preferred_languages,1),0) > 0
    INTO v_name, v_flavor
  FROM user_profiles WHERE id = v_owner_id;

  INSERT INTO notifications (user_id, type, title, message, content_id, action_url)
  VALUES (
    v_owner_id, 'first_engagement',
    CASE WHEN v_flavor THEN 'Yebo!' ELSE 'Someone liked your first upload' END,
    CASE WHEN v_flavor THEN 'Someone''s watching, ' || v_name || '. Your first upload just got its first like.'
         ELSE 'Someone just liked your first upload.' END,
    NEW.content_id,
    '/content-detail.html?id=' || NEW.content_id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_first_engagement ON content_likes;
CREATE TRIGGER trg_notify_first_engagement
  AFTER INSERT ON content_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_first_engagement();
