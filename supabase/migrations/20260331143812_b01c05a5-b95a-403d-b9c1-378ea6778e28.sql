
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  initial_amount numeric NOT NULL DEFAULT 0,
  total_cash numeric NOT NULL DEFAULT 0,
  total_pix numeric NOT NULL DEFAULT 0,
  total_card numeric NOT NULL DEFAULT 0,
  total_fiado numeric NOT NULL DEFAULT 0,
  total_sales numeric NOT NULL DEFAULT 0,
  notes text DEFAULT ''
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cash_registers"
  ON public.cash_registers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert cash_registers"
  ON public.cash_registers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update cash_registers"
  ON public.cash_registers FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins can delete cash_registers"
  ON public.cash_registers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers;
