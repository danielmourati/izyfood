REVOKE EXECUTE ON FUNCTION public.claim_print_job(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid,text) TO service_role;
COMMENT ON FUNCTION public.claim_print_job(uuid,text) IS 'Internal claim implementation; authenticated devices must call claim_print_job_for_host to verify the active tenant device lease.';