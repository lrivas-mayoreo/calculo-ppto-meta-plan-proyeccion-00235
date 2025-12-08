-- ============================================
-- SCHEMA MIGRATION SCRIPT FOR EXTERNAL SUPABASE
-- Generated: 2024-12-08
-- ============================================

-- 1. CREATE ENUM FOR ROLES
CREATE TYPE public.app_role AS ENUM ('administrador', 'gerente', 'vendedor', 'contabilidad');

-- 2. CREATE PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. CREATE USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. CREATE HELPER FUNCTION FOR ROLE CHECKING
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'administrador'::app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'administrador'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'administrador'::app_role));

-- 5. CREATE CLIENTES TABLE
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients" ON public.clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON public.clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON public.clientes FOR DELETE USING (auth.uid() = user_id);

-- 6. CREATE MARCAS TABLE
CREATE TABLE public.marcas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);

ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brands" ON public.marcas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own brands" ON public.marcas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own brands" ON public.marcas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brands" ON public.marcas FOR DELETE USING (auth.uid() = user_id);

-- 7. CREATE VENDEDORES TABLE
CREATE TABLE public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vendors" ON public.vendedores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own vendors" ON public.vendedores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own vendors" ON public.vendedores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vendors" ON public.vendedores FOR DELETE USING (auth.uid() = user_id);

-- 8. CREATE VENTAS_REALES TABLE
CREATE TABLE public.ventas_reales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  codigo_cliente TEXT NOT NULL,
  codigo_marca TEXT NOT NULL,
  codigo_vendedor TEXT,
  mes TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ventas_reales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sales" ON public.ventas_reales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sales" ON public.ventas_reales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sales" ON public.ventas_reales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sales" ON public.ventas_reales FOR DELETE USING (auth.uid() = user_id);

-- 9. CREATE BUDGETS TABLE
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  marca TEXT NOT NULL,
  fecha_destino TEXT NOT NULL,
  empresa TEXT NOT NULL,
  presupuesto NUMERIC NOT NULL,
  vendor_adjustments JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- 10. CREATE IMPORT JOBS TABLE
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import jobs" ON public.import_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own import jobs" ON public.import_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own import jobs" ON public.import_jobs FOR UPDATE USING (auth.uid() = user_id);

-- 11. CREATE IMPORT STAGING TABLE
CREATE TABLE public.import_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  row_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own staging data" ON public.import_staging FOR SELECT
USING (EXISTS (
  SELECT 1 FROM import_jobs WHERE import_jobs.id = import_staging.job_id AND import_jobs.user_id = auth.uid()
));

CREATE POLICY "Service role can manage staging" ON public.import_staging FOR ALL USING (true) WITH CHECK (true);

-- 12. CREATE UPDATE TIMESTAMP FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 13. CREATE TRIGGERS FOR UPDATED_AT
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marcas_updated_at BEFORE UPDATE ON public.marcas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendedores_updated_at BEFORE UPDATE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ventas_reales_updated_at BEFORE UPDATE ON public.ventas_reales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. CREATE HANDLE NEW USER FUNCTION (for auto-creating profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

-- 15. CREATE TRIGGER FOR NEW USER
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16. CREATE PROCESS IMPORT BATCH FUNCTION
CREATE OR REPLACE FUNCTION public.process_import_batch(p_job_id uuid, p_batch_size integer DEFAULT 2000)
RETURNS TABLE(processed integer, errors integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_job_type TEXT;
  v_user_id UUID;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  SELECT type, user_id INTO v_job_type, v_user_id
  FROM import_jobs WHERE id = p_job_id;

  IF v_job_type IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  IF v_job_type = 'clientes' THEN
    WITH batch_data AS (
      SELECT DISTINCT ON (row_data->>'codigo')
        import_staging.id, 
        row_data->>'codigo' as codigo,
        row_data->>'nombre' as nombre
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      ORDER BY row_data->>'codigo', import_staging.id
      LIMIT p_batch_size
    )
    INSERT INTO clientes (user_id, codigo, nombre)
    SELECT v_user_id, codigo, nombre FROM batch_data
    ON CONFLICT (user_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now();
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'marcas' THEN
    WITH batch_data AS (
      SELECT DISTINCT ON (row_data->>'codigo')
        import_staging.id,
        row_data->>'codigo' as codigo,
        row_data->>'nombre' as nombre
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      ORDER BY row_data->>'codigo', import_staging.id
      LIMIT p_batch_size
    )
    INSERT INTO marcas (user_id, codigo, nombre)
    SELECT v_user_id, codigo, nombre FROM batch_data
    ON CONFLICT (user_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now();
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'vendedores' THEN
    WITH batch_data AS (
      SELECT DISTINCT ON (row_data->>'codigo')
        import_staging.id,
        row_data->>'codigo' as codigo,
        row_data->>'nombre' as nombre
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      ORDER BY row_data->>'codigo', import_staging.id
      LIMIT p_batch_size
    )
    INSERT INTO vendedores (user_id, codigo, nombre)
    SELECT v_user_id, codigo, nombre FROM batch_data
    ON CONFLICT (user_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now();
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'ventas' THEN
    WITH batch_data AS (
      SELECT 
        import_staging.id,
        row_data->>'codigo_cliente' as codigo_cliente,
        row_data->>'codigo_marca' as codigo_marca,
        row_data->>'codigo_vendedor' as codigo_vendedor,
        row_data->>'mes' as mes,
        (row_data->>'monto')::numeric as monto
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      LIMIT p_batch_size
    ),
    validated_data AS (
      SELECT bd.*
      FROM batch_data bd
      WHERE 
        EXISTS (SELECT 1 FROM clientes WHERE user_id = v_user_id AND codigo = bd.codigo_cliente)
        AND EXISTS (SELECT 1 FROM marcas WHERE user_id = v_user_id AND codigo = bd.codigo_marca)
        AND (bd.codigo_vendedor IS NULL OR EXISTS (SELECT 1 FROM vendedores WHERE user_id = v_user_id AND codigo = bd.codigo_vendedor))
    )
    INSERT INTO ventas_reales (user_id, codigo_cliente, codigo_marca, codigo_vendedor, mes, monto)
    SELECT v_user_id, codigo_cliente, codigo_marca, codigo_vendedor, mes, monto FROM validated_data;
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    SELECT (p_batch_size - v_processed) INTO v_errors;
  END IF;

  UPDATE import_staging SET processed = true
  WHERE id IN (
    SELECT import_staging.id FROM import_staging
    WHERE job_id = p_job_id AND NOT import_staging.processed
    LIMIT p_batch_size
  );

  UPDATE import_jobs
  SET 
    processed_rows = import_jobs.processed_rows + v_processed,
    error_count = import_jobs.error_count + v_errors,
    success_count = import_jobs.success_count + v_processed,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$function$;
