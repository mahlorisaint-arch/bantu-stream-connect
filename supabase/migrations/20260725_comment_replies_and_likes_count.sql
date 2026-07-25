-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- The app only ships the anon key client-side, which cannot run DDL, so
-- this can't be applied automatically from the app code.
--
-- Fixes two bugs reported on content-detail.html's comments section:
-- 1. Replying to a comment 404s: js/content-detail/comments-section.js's
--    submitReply()/loadReplies() insert into and select from a
--    `comment_replies` table that was never created.
-- 2. Sorting by "Most Liked" 400s with "column comments.likes_count does
--    not exist": likes are tracked correctly in a separate `comment_likes`
--    table (comment_id, user_id rows), but nothing ever denormalized a
--    count onto `comments` for the sort query to order by.
--
-- Column types below are confirmed from a live insert response captured
-- in the browser console: comments.id and user_id are uuid, content_id is
-- integer.

-- ============================================================
-- 1. comment_replies table
-- ============================================================
create table if not exists public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  author_avatar text,
  reply_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists comment_replies_comment_id_idx
  on public.comment_replies (comment_id);

alter table public.comment_replies enable row level security;

-- Replies are publicly readable (comments themselves are public on this
-- page), but only their author can create/edit/delete them.
create policy "comment_replies_select_all"
  on public.comment_replies for select
  using (true);

create policy "comment_replies_insert_own"
  on public.comment_replies for insert
  with check (auth.uid() = user_id);

create policy "comment_replies_update_own"
  on public.comment_replies for update
  using (auth.uid() = user_id);

create policy "comment_replies_delete_own"
  on public.comment_replies for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 2. comments.likes_count — denormalized counter kept in sync by a
--    trigger on comment_likes, so "Most Liked" can ORDER BY it directly
--    instead of a live join/count on every sort (and existing app code
--    at comments-section.js:906 already expects exactly this column).
-- ============================================================
alter table public.comments
  add column if not exists likes_count integer not null default 0;

-- Backfill from whatever comment_likes rows already exist, so historical
-- comments don't show 0 when they actually have likes.
update public.comments c
set likes_count = (
  select count(*) from public.comment_likes cl where cl.comment_id = c.id
);

create or replace function public.sync_comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.comments set likes_count = likes_count + 1 where id = NEW.comment_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.comments set likes_count = greatest(likes_count - 1, 0) where id = OLD.comment_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_likes_count_trigger on public.comment_likes;
create trigger comment_likes_count_trigger
after insert or delete on public.comment_likes
for each row execute function public.sync_comment_likes_count();
