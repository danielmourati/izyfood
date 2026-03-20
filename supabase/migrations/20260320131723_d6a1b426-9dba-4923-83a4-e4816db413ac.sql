ALTER TABLE public.products ADD COLUMN loyalty_eligible boolean NOT NULL DEFAULT false;

UPDATE public.products SET loyalty_eligible = true WHERE category_id IN (SELECT id FROM public.categories WHERE lower(name) LIKE '%açaí%' OR lower(name) LIKE '%acai%');

ALTER TABLE public.products REPLICA IDENTITY FULL;