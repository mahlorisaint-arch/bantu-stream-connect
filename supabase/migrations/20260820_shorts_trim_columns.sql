-- Trim points chosen in the mobile app's in-app Shorts camera capture flow
-- (ShortsCameraScreen -> ShortsTrimScreen). The mobile app never re-encodes
-- locally - see shorts_trim_screen.dart's doc comment - so these are just
-- the creator's chosen start/end points; the self-hosted transcoder
-- (transcoder/index.js's trimInput()) reads them and performs the actual
-- ffmpeg -ss/-t cut before running its existing rendition-ladder pipeline.
alter table "Content"
  add column if not exists trim_start_ms integer,
  add column if not exists trim_end_ms integer;

comment on column "Content".trim_start_ms is 'Start offset (ms) into the raw uploaded file to trim from, chosen in-app. Null means no trim requested.';
comment on column "Content".trim_end_ms is 'End offset (ms) into the raw uploaded file to trim to, chosen in-app. Null means no trim requested.';
