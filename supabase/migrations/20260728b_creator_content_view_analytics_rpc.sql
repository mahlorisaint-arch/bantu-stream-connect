-- Applied live via the Supabase MCP tool (2026-07-28, second pass same
-- day as 20260728_creator_view_analytics_rpc.sql). Record only - already
-- applied.
--
-- Per-content-item counterpart to get_creator_view_analytics() (same
-- migration set, same root cause: content_views RLS only lets a *viewer*
-- read their own row, never a creator reading views on content they own).
-- Used by getContentList() for the Top Performing Content table, which
-- was grouping raw content_views rows per content_id client-side and
-- getting back nothing for the same RLS reason.
CREATE OR REPLACE FUNCTION public.get_creator_content_view_analytics(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_content_ids bigint[],
  p_audience_segment text DEFAULT 'all'
)
RETURNS TABLE(
  content_id bigint,
  total_views bigint,
  total_watch_time_seconds numeric,
  unique_viewers bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    cv.content_id,
    COUNT(cv.*)::bigint AS total_views,
    COALESCE(SUM(cv.view_duration), 0)::numeric AS total_watch_time_seconds,
    COUNT(DISTINCT cv.viewer_id)::bigint AS unique_viewers
  FROM public.content_views cv
  JOIN public."Content" c ON cv.content_id = c.id
  WHERE c.user_id = auth.uid()
    AND cv.content_id = ANY(p_content_ids)
    AND cv.created_at >= p_start_date
    AND cv.created_at <= p_end_date
    AND (
      p_audience_segment = 'all'
      OR p_audience_segment = 'returning'
      OR (p_audience_segment = 'new' AND cv.created_at >= now() - interval '7 days')
      OR (p_audience_segment = 'connectors' AND cv.viewer_id IN (
            SELECT connector_id FROM public.connectors WHERE connected_id = auth.uid()
          ))
    )
  GROUP BY cv.content_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_creator_content_view_analytics(timestamptz, timestamptz, bigint[], text) TO authenticated;
