REVOKE ALL ON FUNCTION public.claim_print_job(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_print_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_print_jobs() TO authenticated, service_role;