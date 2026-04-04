ALTER TABLE public.orders
  ADD COLUMN pickup_person text,
  ADD COLUMN production_time text,
  ADD COLUMN pickup_time text,
  ADD COLUMN pickup_notes text;