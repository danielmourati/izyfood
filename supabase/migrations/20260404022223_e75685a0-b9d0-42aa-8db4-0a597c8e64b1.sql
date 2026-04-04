
-- ============================================
-- Add tenant_id to all existing tables
-- ============================================

-- PRODUCTS
ALTER TABLE public.products ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.products SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- ORDERS
ALTER TABLE public.orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.orders SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- SALES
ALTER TABLE public.sales ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.sales SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sales ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- CUSTOMERS
ALTER TABLE public.customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.customers SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- CATEGORIES
ALTER TABLE public.categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.categories SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- COUPONS
ALTER TABLE public.coupons ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.coupons SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.coupons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.coupons ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- CASH_REGISTERS
ALTER TABLE public.cash_registers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.cash_registers SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.cash_registers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cash_registers ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- STORE_TABLES
ALTER TABLE public.store_tables ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.store_tables SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.store_tables ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.store_tables ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- STORE_SETTINGS
ALTER TABLE public.store_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.store_settings SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.store_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.store_settings ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- SUPPLIERS
ALTER TABLE public.suppliers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.suppliers SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.suppliers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- STOCK_ENTRIES
ALTER TABLE public.stock_entries ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.stock_entries SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.stock_entries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.stock_entries ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id());

-- ============================================
-- Drop ALL old RLS policies
-- ============================================

-- products
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Atendentes can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can read products" ON public.products;

-- orders
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can update orders" ON public.orders;

-- sales
DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated can read sales" ON public.sales;

-- customers
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can read customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can update customers" ON public.customers;

-- categories
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated can read categories" ON public.categories;

-- coupons
DROP POLICY IF EXISTS "Admins can delete coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can insert coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated can read coupons" ON public.coupons;

-- cash_registers
DROP POLICY IF EXISTS "Admins can delete cash_registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Authenticated can insert cash_registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Authenticated can read cash_registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Authenticated can update cash_registers" ON public.cash_registers;

-- store_tables
DROP POLICY IF EXISTS "Admins can delete store_tables" ON public.store_tables;
DROP POLICY IF EXISTS "Authenticated can insert store_tables" ON public.store_tables;
DROP POLICY IF EXISTS "Authenticated can read store_tables" ON public.store_tables;
DROP POLICY IF EXISTS "Authenticated can update store_tables" ON public.store_tables;

-- store_settings
DROP POLICY IF EXISTS "Admins can insert settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.store_settings;

-- suppliers
DROP POLICY IF EXISTS "Admins can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated can read suppliers" ON public.suppliers;

-- stock_entries
DROP POLICY IF EXISTS "Admins can delete stock_entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Authenticated can insert stock_entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Authenticated can read stock_entries" ON public.stock_entries;

-- ============================================
-- Create new tenant-aware RLS policies
-- ============================================

-- Helper: check if user is admin or superadmin for their tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id
      AND role IN ('admin', 'superadmin')
  )
$$;

-- ---- PRODUCTS ----
CREATE POLICY "Superadmin full access products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read products" ON public.products FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant members update products" ON public.products FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete products" ON public.products FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- ORDERS ----
CREATE POLICY "Superadmin full access orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read orders" ON public.orders FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members update orders" ON public.orders FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- SALES ----
CREATE POLICY "Superadmin full access sales" ON public.sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read sales" ON public.sales FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members insert sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete sales" ON public.sales FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- CUSTOMERS ----
CREATE POLICY "Superadmin full access customers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read customers" ON public.customers FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members update customers" ON public.customers FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete customers" ON public.customers FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- CATEGORIES ----
CREATE POLICY "Superadmin full access categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read categories" ON public.categories FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins insert categories" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins update categories" ON public.categories FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins delete categories" ON public.categories FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- COUPONS ----
CREATE POLICY "Superadmin full access coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read coupons" ON public.coupons FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins insert coupons" ON public.coupons FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins update coupons" ON public.coupons FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins delete coupons" ON public.coupons FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- CASH_REGISTERS ----
CREATE POLICY "Superadmin full access cash_registers" ON public.cash_registers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read cash_registers" ON public.cash_registers FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members insert cash_registers" ON public.cash_registers FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members update cash_registers" ON public.cash_registers FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete cash_registers" ON public.cash_registers FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- STORE_TABLES ----
CREATE POLICY "Superadmin full access store_tables" ON public.store_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read store_tables" ON public.store_tables FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members insert store_tables" ON public.store_tables FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members update store_tables" ON public.store_tables FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete store_tables" ON public.store_tables FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- STORE_SETTINGS ----
CREATE POLICY "Superadmin full access store_settings" ON public.store_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read store_settings" ON public.store_settings FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins insert store_settings" ON public.store_settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins update store_settings" ON public.store_settings FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- SUPPLIERS ----
CREATE POLICY "Superadmin full access suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins insert suppliers" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins update suppliers" ON public.suppliers FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));
CREATE POLICY "Tenant admins delete suppliers" ON public.suppliers FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ---- STOCK_ENTRIES ----
CREATE POLICY "Superadmin full access stock_entries" ON public.stock_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members read stock_entries" ON public.stock_entries FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members insert stock_entries" ON public.stock_entries FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins delete stock_entries" ON public.stock_entries FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX idx_coupons_tenant ON public.coupons(tenant_id);
CREATE INDEX idx_cash_registers_tenant ON public.cash_registers(tenant_id);
CREATE INDEX idx_store_tables_tenant ON public.store_tables(tenant_id);
CREATE INDEX idx_store_settings_tenant ON public.store_settings(tenant_id);
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_stock_entries_tenant ON public.stock_entries(tenant_id);
