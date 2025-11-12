-- Tabla para trackear trabajos de importación
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('clientes', 'marcas', 'vendedores', 'ventas')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla staging para datos temporales
CREATE TABLE IF NOT EXISTS public.import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_staging ENABLE ROW LEVEL SECURITY;

-- Políticas para import_jobs
CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas para import_staging
CREATE POLICY "Users can view their own staging data"
  ON public.import_staging FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.import_jobs
    WHERE import_jobs.id = import_staging.job_id
    AND import_jobs.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage staging"
  ON public.import_staging FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_status ON public.import_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_import_staging_job_processed ON public.import_staging(job_id, processed);

-- Trigger para updated_at
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para procesar lotes desde staging
CREATE OR REPLACE FUNCTION public.process_import_batch(
  p_job_id UUID,
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE (processed INTEGER, errors INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_type TEXT;
  v_user_id UUID;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
  v_row RECORD;
BEGIN
  -- Obtener info del job
  SELECT type, user_id INTO v_job_type, v_user_id
  FROM import_jobs WHERE id = p_job_id;

  -- Procesar lote de staging
  FOR v_row IN 
    SELECT id, row_data
    FROM import_staging
    WHERE job_id = p_job_id AND NOT processed
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Procesar según el tipo
      IF v_job_type = 'clientes' THEN
        INSERT INTO clientes (user_id, codigo, nombre)
        VALUES (v_user_id, v_row.row_data->>'codigo', v_row.row_data->>'nombre')
        ON CONFLICT (user_id, codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre, updated_at = now();
        
      ELSIF v_job_type = 'marcas' THEN
        INSERT INTO marcas (user_id, codigo, nombre)
        VALUES (v_user_id, v_row.row_data->>'codigo', v_row.row_data->>'nombre')
        ON CONFLICT (user_id, codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre, updated_at = now();
        
      ELSIF v_job_type = 'vendedores' THEN
        INSERT INTO vendedores (user_id, codigo, nombre)
        VALUES (v_user_id, v_row.row_data->>'codigo', v_row.row_data->>'nombre')
        ON CONFLICT (user_id, codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre, updated_at = now();
        
      ELSIF v_job_type = 'ventas' THEN
        INSERT INTO ventas_reales (user_id, codigo_cliente, codigo_marca, codigo_vendedor, mes, monto)
        VALUES (
          v_user_id,
          v_row.row_data->>'codigo_cliente',
          v_row.row_data->>'codigo_marca',
          v_row.row_data->>'codigo_vendedor',
          v_row.row_data->>'mes',
          (v_row.row_data->>'monto')::numeric
        );
      END IF;

      -- Marcar como procesado
      UPDATE import_staging SET processed = true WHERE id = v_row.id;
      v_processed := v_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      -- Continuar con el siguiente
    END;
  END LOOP;

  -- Actualizar job
  UPDATE import_jobs
  SET processed_rows = processed_rows + v_processed,
      error_count = error_count + v_errors,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$$;