CREATE TABLE public.print_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid,
  device_label text,
  kind text NOT NULL DEFAULT 'order',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  paper_width integer,
  copies integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  claimed_by text,
  claimed_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view print jobs"
ON public.print_jobs FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can create print jobs"
ON public.print_jobs FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can update print jobs"
ON public.print_jobs FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can delete print jobs"
ON public.print_jobs FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_print_jobs_tenant_status ON public.print_jobs (tenant_id, status, created_at);

CREATE TRIGGER trg_print_jobs_updated_at
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_print_job(_job_id uuid, _claimed_by text)
RETURNS SETOF public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.print_jobs
  SET status = 'printing',
      claimed_by = _claimed_by,
      claimed_at = now(),
      attempts = attempts + 1,
      error = NULL
  WHERE id = _job_id
    AND tenant_id = get_user_tenant_id()
    AND status IN ('pending', 'error')
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_print_jobs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.print_jobs
  WHERE tenant_id = get_user_tenant_id()
    AND status = 'done'
    AND created_at < now() - interval '24 hours';
$$;

ALTER TABLE public.print_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;