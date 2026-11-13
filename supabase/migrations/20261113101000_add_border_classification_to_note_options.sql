-- Allow 'border' classification on product_note_options for free and paid pizza/calzone borders
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.product_note_options'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%classification%'
  LOOP
    EXECUTE format('ALTER TABLE public.product_note_options DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.product_note_options
  ADD CONSTRAINT product_note_options_classification_check
  CHECK (classification IS NULL OR classification IN ('flavor', 'additional', 'both', 'border'));

