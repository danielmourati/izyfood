GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_intents TO authenticated;

DROP POLICY IF EXISTS "Superadmins manage payment intents" ON public.payment_intents;
CREATE POLICY "Superadmins manage payment intents"
  ON public.payment_intents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

