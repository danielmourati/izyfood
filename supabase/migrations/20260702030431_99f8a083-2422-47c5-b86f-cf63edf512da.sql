-- Trigger-only SECURITY DEFINER functions: revoke direct EXECUTE from anon/authenticated/public.
-- These are invoked only by database triggers, never called from client code or RLS policies.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_tenant_trial() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_tables() FROM PUBLIC, anon, authenticated;