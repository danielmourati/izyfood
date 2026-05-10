-- Add control_stock to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS control_stock BOOLEAN NOT NULL DEFAULT true;

-- Create product_note_options table
CREATE TABLE IF NOT EXISTS public.product_note_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT get_user_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('note', 'complement')),
    price NUMERIC DEFAULT 0,
    category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Apply updated_at trigger
CREATE TRIGGER update_product_note_options_updated_at BEFORE UPDATE ON public.product_note_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for product_note_options
ALTER TABLE public.product_note_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read product_note_options" ON public.product_note_options
    FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant members insert product_note_options" ON public.product_note_options
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant members update product_note_options" ON public.product_note_options
    FOR UPDATE TO authenticated
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant members delete product_note_options" ON public.product_note_options
    FOR DELETE TO authenticated
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Superadmin full access product_note_options" ON public.product_note_options
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'superadmin'))
    WITH CHECK (has_role(auth.uid(), 'superadmin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_note_options;

