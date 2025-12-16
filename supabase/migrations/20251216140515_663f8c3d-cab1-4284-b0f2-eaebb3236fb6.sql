
-- 1. Create roles table with main roles
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Insert the main roles
INSERT INTO public.roles (nombre) VALUES 
  ('administrador'),
  ('vendedor'),
  ('gerente'),
  ('adm. ventas');

-- Enable RLS on roles (readable by all authenticated users)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view roles"
ON public.roles FOR SELECT TO authenticated
USING (true);

-- 2. Backup existing user_roles data before modifying
CREATE TEMP TABLE temp_user_roles AS
SELECT user_id, role::text as role_name FROM public.user_roles;

-- Drop existing user_roles policies and table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP TABLE public.user_roles;

-- Recreate user_roles as a relation table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrate existing data
INSERT INTO public.user_roles (user_id, role_id)
SELECT t.user_id, r.id
FROM temp_user_roles t
JOIN public.roles r ON r.nombre = t.role_name;

-- Drop temp table
DROP TABLE temp_user_roles;

-- 3. Update has_role function to work with new structure
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.nombre = _role_name
  )
$$;

-- 4. Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

-- 5. Create relation tables for marcas, clientes, vendedores per role
CREATE TABLE public.marcas_per_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.marcas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, marca_id)
);

CREATE TABLE public.clientes_per_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, cliente_id)
);

CREATE TABLE public.vendedores_per_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, vendedor_id)
);

-- Enable RLS on relation tables
ALTER TABLE public.marcas_per_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_per_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores_per_role ENABLE ROW LEVEL SECURITY;

-- RLS for relation tables (admins can manage, authenticated can view)
CREATE POLICY "Authenticated can view marcas_per_role"
ON public.marcas_per_role FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage marcas_per_role"
ON public.marcas_per_role FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

CREATE POLICY "Authenticated can view clientes_per_role"
ON public.clientes_per_role FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage clientes_per_role"
ON public.clientes_per_role FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

CREATE POLICY "Authenticated can view vendedores_per_role"
ON public.vendedores_per_role FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage vendedores_per_role"
ON public.vendedores_per_role FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

-- 6. Update ventas_reales: remove user_id dependency and make public for authenticated
DROP POLICY IF EXISTS "Users can view their own sales" ON public.ventas_reales;
DROP POLICY IF EXISTS "Users can insert their own sales" ON public.ventas_reales;
DROP POLICY IF EXISTS "Users can update their own sales" ON public.ventas_reales;
DROP POLICY IF EXISTS "Users can delete their own sales" ON public.ventas_reales;

-- Make ventas_reales viewable by all authenticated users
CREATE POLICY "Authenticated users can view all sales"
ON public.ventas_reales FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sales"
ON public.ventas_reales FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

-- 7. Update marcas, clientes, vendedores to be viewable by all authenticated (data filtering via relation tables)
DROP POLICY IF EXISTS "Users can view their own brands" ON public.marcas;
DROP POLICY IF EXISTS "Users can insert their own brands" ON public.marcas;
DROP POLICY IF EXISTS "Users can update their own brands" ON public.marcas;
DROP POLICY IF EXISTS "Users can delete their own brands" ON public.marcas;

CREATE POLICY "Authenticated can view all marcas"
ON public.marcas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage marcas"
ON public.marcas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS "Users can view their own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clientes;

CREATE POLICY "Authenticated can view all clientes"
ON public.clientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage clientes"
ON public.clientes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS "Users can view their own vendors" ON public.vendedores;
DROP POLICY IF EXISTS "Users can insert their own vendors" ON public.vendedores;
DROP POLICY IF EXISTS "Users can update their own vendors" ON public.vendedores;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON public.vendedores;

CREATE POLICY "Authenticated can view all vendedores"
ON public.vendedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage vendedores"
ON public.vendedores FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));
