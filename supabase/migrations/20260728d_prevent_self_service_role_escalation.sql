-- Applied live via the Supabase MCP tool (2026-07-28, fourth pass same day
-- as the creator-analytics RPC migrations). Record only - already applied.
--
-- SECURITY FIX: user_profiles.role is a real authorization field (e.g.
-- "Admins can manage comment reports" on public.comment_reports checks
-- user_profiles.role = 'admin'), but user_profiles' own INSERT/UPDATE RLS
-- policies only ever checked row ownership (auth.uid() = id) - never what
-- value of `role` was being written. Any authenticated user could run
-- `supabase.from('user_profiles').update({role:'admin'}).eq('id', myId)`
-- directly (bypassing the UI entirely) and grant themselves admin access.
-- Confirmed exploitable: zero existing rows currently have role='admin'
-- (all 48 are 'creator'), so this closes the gap before it's ever been used.
--
-- Fixed with a trigger rather than folding into the RLS WITH CHECK clause,
-- since WITH CHECK can't cleanly reference the pre-update value of the same
-- row it's validating. auth.role() = 'authenticated' scopes this to actual
-- end-user requests through PostgREST only - it does not fire for
-- service_role/SECURITY DEFINER paths (e.g. the on_auth_user_created
-- trigger's own INSERT, or a future admin-granting backend job), which
-- remain the only legitimate way to change role.
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'role cannot be changed by the account owner';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.user_profiles;
CREATE TRIGGER trg_prevent_self_role_change
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_role_change();

-- Same gap on INSERT: the client-side signup path (and anyone calling the
-- REST API directly) could set role to anything, not just 'creator'. Lock
-- self-service INSERT to the one role value the app actually assigns at
-- signup - matches what the on_auth_user_created trigger already does
-- server-side (it runs as SECURITY DEFINER and bypasses RLS, so it is
-- unaffected by this).
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'creator');
