
-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'atendente', 'motoboy');

-- Enum for product type
CREATE TYPE public.product_type AS ENUM ('unit', 'weight');

-- Enum for order type
CREATE TYPE public.order_type AS ENUM ('balcao', 'mesa', 'delivery', 'retirada');

-- Enum for order status
CREATE TYPE public.order_status AS ENUM ('aberto', 'segurado', 'finalizado', 'cancelado', 'pronto');

-- Enum for delivery status
CREATE TYPE public.delivery_status AS ENUM ('pendente', 'pronto', 'finalizado');

-- Enum for payment method
CREATE TYPE public.payment_method AS ENUM ('pix', 'cartao', 'fiado', 'dinheiro');

-- Enum for order source
CREATE TYPE public.order_source AS ENUM ('ifood', 'aiqfome', 'whatsapp', 'instagram', 'telefone', 'loja', 'outro');

-- Enum for discount type
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

-- Enum for table status
CREATE TYPE public.table_status AS ENUM ('available', 'occupied');

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER FUNCTION: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- CATEGORIES TABLE
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- PRODUCTS TABLE
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type product_type NOT NULL DEFAULT 'unit',
  unit TEXT NOT NULL DEFAULT 'un',
  stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- CUSTOMERS TABLE
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- SUPPLIERS TABLE
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- ORDERS TABLE
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_type order_type NOT NULL DEFAULT 'balcao',
  status order_status NOT NULL DEFAULT 'aberto',
  table_number INTEGER,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  delivery_fee NUMERIC(10,2),
  delivery_status delivery_status,
  order_source order_source,
  motoboy_name TEXT,
  payment_method payment_method,
  payment_splits JSONB,
  discount NUMERIC(10,2),
  discount_type discount_type,
  coupon_id UUID,
  loyalty_redemptions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  held_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- SALES TABLE
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- STOCK ENTRIES TABLE
CREATE TABLE public.stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

-- STORE TABLES (mesas)
CREATE TABLE public.store_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  status table_status NOT NULL DEFAULT 'available',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL
);
ALTER TABLE public.store_tables ENABLE ROW LEVEL SECURITY;

-- COUPONS TABLE
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type discount_type NOT NULL DEFAULT 'percentage',
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  min_order NUMERIC(10,2),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- STORE SETTINGS TABLE
CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_count INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- Profiles
CREATE POLICY "Anyone authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Categories
CREATE POLICY "Authenticated can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Products
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Atendentes can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'atendente'));

-- Customers
CREATE POLICY "Authenticated can read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers
CREATE POLICY "Authenticated can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Orders
CREATE POLICY "Authenticated can read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Sales
CREATE POLICY "Authenticated can read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Stock Entries
CREATE POLICY "Authenticated can read stock_entries" ON public.stock_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert stock_entries" ON public.stock_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete stock_entries" ON public.stock_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Store Tables
CREATE POLICY "Authenticated can read store_tables" ON public.store_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert store_tables" ON public.store_tables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update store_tables" ON public.store_tables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete store_tables" ON public.store_tables FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Coupons
CREATE POLICY "Authenticated can read coupons" ON public.coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update coupons" ON public.coupons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete coupons" ON public.coupons FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Store Settings
CREATE POLICY "Authenticated can read settings" ON public.store_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert settings" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings" ON public.store_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;

-- INSERT DEFAULT DATA
INSERT INTO public.store_settings (table_count) VALUES (20);
INSERT INTO public.store_tables (number, status) SELECT generate_series(1, 20), 'available';
