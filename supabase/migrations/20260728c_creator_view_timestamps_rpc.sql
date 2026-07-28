-- Applied live via the Supabase MCP tool (2026-07-28, third pass same day
-- as 20260728_creator_view_analytics_rpc.sql /
-- 20260728b_creator_content_view_analytics_rpc.sql). Record only - already
-- applied.
--
-- Third and last function in this set (same root cause as
-- get_creator_view_analytics()/get_creator_content_view_analytics()).
-- Used by getPeakViewingTimes() for the Peak Viewing Times card, which
-- buckets raw content_views.created_at timestamps into hour-of-day/
-- day-of-week counts client-side (kept client-side so the bucketing stays
-- in the browser's local timezone, matching the existing behavior exactly).
CREATE OR REPLACE FUNCTION public.get_creator_view_timestamps(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT cv.created_at
  FROM public.content_views cv
  JOIN public."Content" c ON cv.content_id = c.id
  WHERE c.user_id = auth.uid()
    AND cv.created_at >= p_start_date
    AND cv.created_at <= p_end_date;
$function$;

GRANT EXECUTE ON FUNCTION public.get_creator_view_timestamps(timestamptz, timestamptz) TO authenticated;
