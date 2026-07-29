-- Minimal seed data for the load test, so playback_heartbeats/watch_progress
-- FK constraints on user_id/content_id don't reject every write.
-- Run this against your LOCAL Supabase instance ONLY (never production).
--
--   supabase db execute -f load-tests/seed-test-data.sql
-- or paste into the local Studio SQL editor at http://127.0.0.1:54323

-- A handful of test users (adjust columns if your user_profiles schema drifts)
INSERT INTO auth.users (id, email)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'loadtest1@example.com'),
    ('22222222-2222-2222-2222-222222222222', 'loadtest2@example.com'),
    ('33333333-3333-3333-3333-333333333333', 'loadtest3@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, username, role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'loadtest_user_1', 'user'),
    ('22222222-2222-2222-2222-222222222222', 'loadtest_user_2', 'user'),
    ('33333333-3333-3333-3333-333333333333', 'loadtest_user_3', 'user')
ON CONFLICT (id) DO NOTHING;

-- A few pieces of content to spread simulated views across (avoids
-- every VU hammering the exact same row and testing lock contention
-- on ONE row instead of realistic spread-out write volume)
INSERT INTO public."Content" (id, title, user_id, status, media_type, duration)
VALUES
    (900001, 'Load Test Content 1', '11111111-1111-1111-1111-111111111111', 'published', 'video', 600),
    (900002, 'Load Test Content 2', '11111111-1111-1111-1111-111111111111', 'published', 'video', 600),
    (900003, 'Load Test Content 3', '11111111-1111-1111-1111-111111111111', 'published', 'video', 600)
ON CONFLICT (id) DO NOTHING;

-- Then run k6 with:
--   k6 run load-tests/telemetry-load-test.js \
--     -e SUPABASE_URL=http://127.0.0.1:54321 \
--     -e SUPABASE_ANON_KEY=<local anon key from `supabase status`> \
--     -e TEST_USER_IDS=11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,33333333-3333-3333-3333-333333333333 \
--     -e TEST_CONTENT_IDS=900001,900002,900003 \
--     -e TARGET_VUS=1000
