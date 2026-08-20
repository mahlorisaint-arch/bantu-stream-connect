-- Tier 3: Shorts filter chosen in-app (see mobile's lib/global/models/
-- shorts_filter.dart for the fixed set). Same pattern as trim_start_ms/
-- trim_end_ms (20260820_shorts_trim_columns.sql) - the mobile app never
-- bakes the filter in on-device, the transcoder reads this column and
-- applies the matching ffmpeg filter chain (transcoder/index.js's
-- FILTER_CHAINS) before the rendition ladder.
alter table "Content" add column if not exists filter_id text;

comment on column "Content".filter_id is 'Shorts filter chosen in-app. Null means no filter / Original.';
