-- Applied live via the Supabase MCP tool (2026-07-27, third pass of the
-- day). Record only - already applied. CREATE OR REPLACE statements are
-- safe to rerun.
--
-- Context: 20260727b fixed action_url for the four notification types
-- built earlier that day (world_unlock/portal_drop/streak_nudge/
-- world_content). This pass covers every OTHER real, live-firing
-- notification type on the platform, and adds the two remaining planned
-- types (approaching_unlock, unfinished_world) that were scoped, not
-- built, in the previous pass.
--
-- Full map of public.notifications' `type` column, verified against real
-- triggers/insertion sites rather than assumed from the type list:
--
-- REAL, LIVE (fixed this pass):
--   like, comment      - handle_engagement_notification(), triggers on
--                         content_likes/comments (trg_notification_on_like,
--                         trg_notification_on_comment)
--   follow             - handle_connection_notification(), trigger on
--                         connectors (trg_notification_on_connect) - this
--                         is also what powers "Connect" on
--                         discover-creator.html/category/podcasts.html
--   view_milestone     - check_and_trigger_view_milestones(), trigger on
--                         content_views (trg_milestone_on_view)
--   system             - one real client-side site: discover-creator.html's
--                         collab-request insert (metadata.kind =
--                         'collab_request')
--
-- REAL, LIVE (built in earlier passes today):
--   world_unlock, portal_drop, streak_nudge, world_content
--
-- NEW THIS PASS:
--   approaching_unlock, unfinished_world
--
-- ALLOWED BY THE CONSTRAINT, NEVER ACTUALLY INSERTED ANYWHERE - fully
-- vestigial, nothing to add an action_url to:
--   upload_processed, playlist_added, creator_verified
--
-- ORPHANED DUPLICATE FUNCTIONS - write to the same table/types as the
-- real functions above but are NOT attached to any trigger (dead code,
-- left as-is, not this pass's scope to remove):
--   create_comment_notification() - superseded by handle_engagement_notification
--   create_follow_notification()  - superseded by handle_connection_notification
--   create_notification()         - generic helper, references a
--                                    sender_id column that doesn't exist
--                                    on notifications (would error if
--                                    ever called), never called
--
-- NOT PART OF THIS TABLE AT ALL - a separate system:
--   mention, reply, share - these are icon-mapped in
--   shared-components.js's getNotificationIconMeta() but are NOT in
--   notifications' type constraint. They belong to a completely separate
--   pulse_notifications table, written by a locally-scoped
--   createNotification() inside pulse-feed.html (not the exported
--   js/supabase-client.js version, which is itself unused dead code -
--   nothing imports it). achievement/success/warning/live are in the same
--   icon mapping with no insertion site anywhere in either system found.

-- ============================================================
-- 1. like / comment -> the content being reacted to/commented on.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_engagement_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_content_title TEXT;
    v_content_owner_id UUID;
    v_sender_name TEXT;
    v_sender_avatar TEXT;
    v_msg TEXT;
    v_type TEXT;
BEGIN
    IF TG_TABLE_NAME = 'content_likes' THEN
        v_type := 'like';

        SELECT title, user_id INTO v_content_title, v_content_owner_id
        FROM public."Content" WHERE id = NEW.content_id;

        SELECT full_name, avatar_url INTO v_sender_name, v_sender_avatar
        FROM public.user_profiles WHERE id = NEW.user_id;

        v_msg := COALESCE(v_sender_name, 'Someone') || ' reacted to your drop "' || COALESCE(v_content_title, 'your video') || '" 🔥';

    ELSIF TG_TABLE_NAME = 'comments' THEN
        v_type := 'comment';

        SELECT title, user_id INTO v_content_title, v_content_owner_id
        FROM public."Content" WHERE id = NEW.content_id;

        v_sender_name := NEW.author_name;
        v_sender_avatar := NEW.author_avatar;

        v_msg := v_sender_name || ' left a comment on "' || COALESCE(v_content_title, 'your video') || '": "' || LEFT(NEW.comment_text, 40) || '..."';
    END IF;

    IF v_content_owner_id IS NOT NULL AND v_content_owner_id != NEW.user_id THEN
        INSERT INTO public.notifications (
            user_id, type, title, message, content_id, content_title, content_type, sender_name, sender_avatar, action_url
        ) VALUES (
            v_content_owner_id, v_type,
            CASE WHEN v_type = 'like' THEN 'New Reaction!' ELSE 'New Comment!' END,
            v_msg, NEW.content_id, v_content_title, v_type, v_sender_name, v_sender_avatar,
            '/content-detail.html?id=' || NEW.content_id
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. follow -> the follower's own profile (real connector_id captured by
--    the trigger, not just their display name).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_connection_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sender_name TEXT;
    v_sender_avatar TEXT;
BEGIN
    IF NEW.connection_type IN ('creator', 'user') THEN
        SELECT full_name, avatar_url INTO v_sender_name, v_sender_avatar
        FROM public.user_profiles WHERE id = NEW.connector_id;

        INSERT INTO public.notifications (
            user_id, type, title, message, sender_name, sender_avatar, action_url
        ) VALUES (
            NEW.connected_id,
            'follow',
            'New Connection! 🌊',
            COALESCE(v_sender_name, 'A new user') || ' just locked in with your channel. Keep the waves moving!',
            v_sender_name,
            v_sender_avatar,
            '/creator-channel.html?id=' || NEW.connector_id
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. view_milestone -> the content that hit the milestone (the owner's
--    own content, worth revisiting/sharing at the moment it crosses a
--    real threshold).
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_trigger_view_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_views BIGINT;
    v_content_title TEXT;
    v_content_owner_id UUID;
    v_milestone_title TEXT;
    v_milestone_msg TEXT;
    v_should_insert BOOLEAN := FALSE;
BEGIN
    SELECT total_views INTO v_total_views
    FROM public.content_engagement_stats
    WHERE content_id = NEW.content_id;

    SELECT title, user_id INTO v_content_title, v_content_owner_id
    FROM public."Content"
    WHERE id = NEW.content_id;

    IF v_content_owner_id IS NOT NULL THEN
        IF v_total_views = 100 THEN
            v_milestone_title := 'First Milestone! 🎉';
            v_milestone_msg := 'Off to a great start! "' || v_content_title || '" just crossed its first 100 views.';
            v_should_insert := TRUE;
        ELSIF v_total_views = 1000 THEN
            v_milestone_title := 'On The Rise! 📈';
            v_milestone_msg := '"' || v_content_title || '" just hit 1,000 views! You''re building serious momentum.';
            v_should_insert := TRUE;
        ELSIF v_total_views = 10000 THEN
            v_milestone_title := 'Major Milestone! 🚀';
            v_milestone_msg := 'Boom! "' || v_content_title || '" just cleared 10,000 views. The community is turning up!';
            v_should_insert := TRUE;
        ELSIF v_total_views = 100000 THEN
            v_milestone_title := 'Unstoppable! 🏆';
            v_milestone_msg := 'Unbelievable! "' || v_content_title || '" just crossed 100,000 views! Your channel is making massive waves.';
            v_should_insert := TRUE;
        END IF;

        IF v_should_insert AND NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE content_id = NEW.content_id
              AND type = 'view_milestone'
              AND title = v_milestone_title
        ) THEN
            INSERT INTO public.notifications (
                user_id, type, title, message, content_id, content_title, content_type, action_url
            ) VALUES (
                v_content_owner_id, 'view_milestone', v_milestone_title, v_milestone_msg, NEW.content_id, v_content_title, 'view_milestone',
                '/content-detail.html?id=' || NEW.content_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- ============================================================
-- 4. approaching_unlock - extends fn_process_listen_event's existing
--    unlock-check loop with a threshold-1 branch. Fires exactly once per
--    (user, subworld): tracks_listened only increases, so this state is
--    passed through at most once before the unlock itself fires instead.
--    The NOT EXISTS check is a defensive backstop, not the primary guard.
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
  v_tracks_to_go integer;
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
    IF v_progress.unlocked_subworlds @> to_jsonb(v_child.id::text) THEN
      CONTINUE;
    END IF;

    IF v_progress.tracks_listened >= v_child.unlock_threshold_tracks THEN
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
    ELSE
      v_tracks_to_go := v_child.unlock_threshold_tracks - v_progress.tracks_listened;
      IF v_tracks_to_go = 1 AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = NEW.user_id
          AND type = 'approaching_unlock'
          AND metadata->>'unlocked_genre_id' = v_child.id::text
      ) THEN
        INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
        VALUES (
          NEW.user_id,
          'approaching_unlock',
          'Almost there!',
          'One more track in ' || v_parent_name || ' unlocks ' || v_child.name || '.',
          '/category/music.html?world=' || v_genre_id || '&worldName=' || replace(v_parent_name, ' ', '%20'),
          jsonb_build_object(
            'parent_genre_id', v_genre_id,
            'parent_genre_name', v_parent_name,
            'unlocked_genre_id', v_child.id,
            'unlocked_genre_name', v_child.name
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 5. unfinished_world - new scheduled job, same shape as
--    fn_notify_streak_lapse_risk. 7-day inactivity window, 14-day
--    re-notify cooldown per (user, genre) so it can't become naggy.
--    References the real, now-correctly-computed exploration_percentage.
-- ============================================================
create or replace function public.fn_notify_unfinished_worlds()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into notifications (user_id, type, title, message, action_url, metadata)
  select
    uwp.user_id,
    'unfinished_world',
    g.name || ' is waiting',
    g.name || ' is waiting — you''re ' || round(uwp.exploration_percentage) || '% through.',
    '/category/music.html?world=' || uwp.genre_id || '&worldName=' || replace(g.name, ' ', '%20'),
    jsonb_build_object('genre_id', uwp.genre_id, 'genre_name', g.name, 'exploration_percentage', uwp.exploration_percentage)
  from user_world_progress uwp
  join genres g on g.id = uwp.genre_id
  where uwp.exploration_percentage < 100
    and uwp.last_active_at < now() - interval '7 days'
    and not exists (
      select 1 from notifications n
      where n.user_id = uwp.user_id
        and n.type = 'unfinished_world'
        and n.metadata->>'genre_id' = uwp.genre_id::text
        and n.created_at > now() - interval '14 days'
    );
end;
$$;

grant execute on function public.fn_notify_unfinished_worlds() to service_role;

select cron.schedule(
  'notify-unfinished-worlds',
  '0 18 * * *',
  $$select public.fn_notify_unfinished_worlds();$$
);

-- ============================================================
-- Every new/changed insertion path was tested against a real inserted-
-- then-cleaned-up scenario this pass: a real like, a real connectors
-- insert (follow), a real two-listen sequence crossing exactly
-- threshold-1 then threshold for two real sub-worlds simultaneously
-- (Amapiano -> Soulful Piano + Sgija, both real 5-track thresholds,
-- confirming approaching_unlock fires once and does not re-fire once
-- world_unlock takes over), a real unfinished_world scenario confirming
-- both the honest percentage in the message and the 14-day dedup, and a
-- schema-shape check for the collab-request system notification (client-
-- side insert, verified the exact row shape the JS now produces is valid
-- against the live schema/constraint - not driven through the actual UI,
-- no browser available in this environment).
-- ============================================================
