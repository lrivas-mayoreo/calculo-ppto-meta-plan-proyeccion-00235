-- Create table for clients
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, codigo)
);

-- Create table for brands
CREATE TABLE public.marcas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, codigo)
);

-- Create table for vendors/sellers
CREATE TABLE public.vendedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, codigo)
);

-- Create table for real sales
CREATE TABLE public.ventas_reales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_cliente text NOT NULL,
  codigo_marca text NOT NULL,
  codigo_vendedor text,
  mes text NOT NULL,
  monto numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, codigo_cliente) REFERENCES public.clientes(user_id, codigo) ON DELETE CASCADE,
  FOREIGN KEY (user_id, codigo_marca) REFERENCES public.marcas(user_id, codigo) ON DELETE CASCADE,
  FOREIGN KEY (user_id, codigo_vendedor) REFERENCES public.vendedores(user_id, codigo) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_reales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clientes
CREATE POLICY "Users can view their own clients"
  ON public.clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
  ON public.clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON public.clientes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON public.clientes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for marcas
CREATE POLICY "Users can view their own brands"
  ON public.marcas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brands"
  ON public.marcas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands"
  ON public.marcas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands"
  ON public.marcas FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for vendedores
CREATE POLICY "Users can view their own vendors"
  ON public.vendedores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vendors"
  ON public.vendedores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vendors"
  ON public.vendedores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vendors"
  ON public.vendedores FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ventas_reales
CREATE POLICY "Users can view their own sales"
  ON public.ventas_reales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales"
  ON public.ventas_reales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales"
  ON public.ventas_reales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales"
  ON public.ventas_reales FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_clientes_user_codigo ON public.clientes(user_id, codigo);
CREATE INDEX idx_marcas_user_codigo ON public.marcas(user_id, codigo);
CREATE INDEX idx_vendedores_user_codigo ON public.vendedores(user_id, codigo);
CREATE INDEX idx_ventas_reales_user_id ON public.ventas_reales(user_id);
CREATE INDEX idx_ventas_reales_mes ON public.ventas_reales(mes);
CREATE INDEX idx_ventas_reales_cliente ON public.ventas_reales(user_id, codigo_cliente);
CREATE INDEX idx_ventas_reales_marca ON public.ventas_reales(user_id, codigo_marca);

-- Create triggers for updated_at
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marcas_updated_at
  BEFORE UPDATE ON public.marcas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedores_updated_at
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ventas_reales_updated_at
  BEFORE UPDATE ON public.ventas_reales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();