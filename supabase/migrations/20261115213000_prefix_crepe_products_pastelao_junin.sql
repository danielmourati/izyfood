-- Prefix "Crepe " to all products in the "Crepes" category for tenant pastelao-junin
UPDATE public.products p
SET name = 'Crepe ' || TRIM(p.name)
FROM public.categories c
JOIN public.tenants t ON t.id = c.tenant_id
WHERE p.category_id = c.id
  AND t.slug = 'pastelao-junin'
  AND c.name ILIKE '%crepe%'
  AND p.name NOT ILIKE 'crepe %'
  AND p.name NOT ILIKE 'crepe';

