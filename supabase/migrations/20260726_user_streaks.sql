-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- The app only ships the anon key client-side, which cannot run DDL, so
-- this can't be applied automatically from the app code.
--
-- Backs the home-feed streak banner. Confirmed via a full codebase +
-- live-schema audit that no streaks table exists anywhere today (a few
-- pages compute one-off streaks client-side from other tables, e.g.
-- creator-channel.js's upload streak and music.js's listening streak, but
-- nothing backs a real per-user watch streak) — this is new infrastructure,
-- not reactivating something dormant.
--
-- CORRECTION (2026-07-27, during the Music Discovery audit + fix pass):
-- this file's premise doesn't match the live database. public.user_streaks
-- already exists in production with a DIFFERENT schema than the CREATE
-- TABLE below (a streak_type check constraint scoped to
-- watch/upload/comment/share, a milestones_achieved jsonb column, no
-- created_at) - it predates this migration and was missed by the audit
-- that produced the comment above. touch_watch_streak() as written here
-- was NEVER actually present in the live database (confirmed via
-- information_schema.routines and zero rows in user_streaks) - meaning the
-- home-feed streak banner has been silently non-functional in production
-- this whole time, not because of a design flaw but because this file was
-- apparently never actually run.
--
-- Repaired live via direct SQL rather than re-running this file (which
-- would fail - the table already exists): touch_watch_streak(p_user_id,
-- p_streak_type default 'watch') now exists for real, the check constraint
-- was widened to include 'listen' (used by music.js's consolidated streak,
-- see js/music/music.js computeAndRenderStreak()), and
-- fn_process_listen_event now calls it for genre-tagged listen completions.
-- See supabase/migrations/20260727_music_worlds_and_notifications.sql for
-- the real, current definitions. Left this file as-is (not rewritten) as a
-- historical record - do not re-run it against production.

create table public.user_streaks (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  streak_type text not null default 'watch',
  current_streak_days integer not null default 0,
  longest_streak_days integer not null default 0,
  last_activity_date date null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_streaks_pkey primary key (id),
  constraint unique_user_streak_type unique (user_id, streak_type),
  constraint user_streaks_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) TABLESPACE pg_default;

create index IF not exists idx_user_streaks_user_id on public.user_streaks using btree (user_id) TABLESPACE pg_default;

alter table public.user_streaks enable row level security;

create policy "user_streaks_select_own"
  on public.user_streaks for select
  using (auth.uid() = user_id);

create policy "user_streaks_all_own"
  on public.user_streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- touch_watch_streak(p_user_id) — called once per real view-completion
-- event (hooked into the existing RPC view-recording path in
-- watch-session.js / recordContentView(), not a new tracking mechanism).
-- Does the increment/reset date-math atomically server-side:
--   - already touched today          -> no-op
--   - last activity was yesterday    -> increment current_streak_days
--   - anything older, or first ever  -> reset current_streak_days to 1
-- SECURITY DEFINER because a client calling this via supabase.rpc() only
-- has the RLS-scoped "own row" access above, but the increment logic
-- needs to run as a trusted operation, same pattern as the comment_replies
-- migration's sync_comment_likes_count() trigger function.
-- ============================================================
create or replace function public.touch_watch_streak(p_user_id uuid)
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
  where user_id = p_user_id and streak_type = 'watch'
  for update;

  if not found then
    insert into public.user_streaks (user_id, streak_type, current_streak_days, longest_streak_days, last_activity_date)
    values (p_user_id, 'watch', 1, 1, current_date);
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
  where user_id = p_user_id and streak_type = 'watch';
end;
$$;

grant execute on function public.touch_watch_streak(uuid) to authenticated;
