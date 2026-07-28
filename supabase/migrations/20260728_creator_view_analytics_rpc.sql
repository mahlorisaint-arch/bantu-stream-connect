-- Applied live via the Supabase MCP tool (2026-07-28). Record only -
-- already applied.
--
-- content_views RLS ("content_views_select_own_history": auth.uid() = user_id
-- OR auth.uid() = viewer_id) only lets a *viewer* read their own view row.
-- It never lets a creator read view rows for content they own but didn't
-- personally watch, so every creator-analytics query against content_views
-- (total views, unique viewers, watch time, completion rate) silently
-- returned near-zero for real creators. This SECURITY DEFINER function
-- bypasses that restriction internally but is hard-scoped to auth.uid() (no
-- creator_id parameter at all), so a caller can only ever get their own
-- aggregate numbers back - never another creator's, and never raw
-- viewer_id/session rows, only the aggregates.
--
-- p_audience_segment mirrors the existing (client-side, currently broken by
-- the same RLS issue) segment semantics in js/creator-analytics.js's
-- _getAudienceSegmentFilter(): 'new' = viewed in the last 7 days,
-- 'connectors' = viewer is a connector of this creator, 'returning' is left
-- as a no-op/same-as-all (matches that function's own comment: "would need
-- a more complex subquery in production").
CREATE OR REPLACE FUNCTION public.get_creator_view_analytics(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_audience_segment text DEFAULT 'all'
)
RETURNS TABLE(
  total_views bigint,
  total_watch_time_seconds numeric,
  unique_viewers bigint,
  avg_completion_rate numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    COUNT(cv.*)::bigint AS total_views,
    COALESCE(SUM(cv.view_duration), 0)::numeric AS total_watch_time_seconds,
    COUNT(DISTINCT cv.viewer_id)::bigint AS unique_viewers,
    COALESCE(AVG(
      CASE WHEN c.duration > 0
        THEN LEAST(100, (cv.view_duration::numeric / c.duration) * 100)
        ELSE NULL
      END
    ), 0)::numeric AS avg_completion_rate
  FROM public.content_views cv
  JOIN public."Content" c ON cv.content_id = c.id
  WHERE c.user_id = auth.uid()
    AND cv.created_at >= p_start_date
    AND cv.created_at <= p_end_date
    AND (
      p_audience_segment = 'all'
      OR p_audience_segment = 'returning'
      OR (p_audience_segment = 'new' AND cv.created_at >= now() - interval '7 days')
      OR (p_audience_segment = 'connectors' AND cv.viewer_id IN (
            SELECT connector_id FROM public.connectors WHERE connected_id = auth.uid()
          ))
    );
$function$;

GRANT EXECUTE ON FUNCTION public.get_creator_view_analytics(timestamptz, timestamptz, text) TO authenticated;
