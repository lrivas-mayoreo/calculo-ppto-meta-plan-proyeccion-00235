-- Optimizar función de procesamiento por lotes para manejar grandes volúmenes
CREATE OR REPLACE FUNCTION public.process_import_batch(
  p_job_id UUID,
  p_batch_size INTEGER DEFAULT 2000
)
RETURNS TABLE(processed INTEGER, errors INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_type TEXT;
  v_user_id UUID;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Obtener info del job
  SELECT type, user_id INTO v_job_type, v_user_id
  FROM import_jobs WHERE id = p_job_id;

  -- Procesar según el tipo con bulk inserts optimizados
  IF v_job_type = 'clientes' THEN
    -- Insert con ON CONFLICT para clientes
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT processed
      LIMIT p_batch_size
    )
    INSERT INTO clientes (user_id, codigo, nombre)
    SELECT 
      v_user_id,
      row_data->>'codigo',
      row_data->>'nombre'
    FROM batch_data
    ON CONFLICT (user_id, codigo) 
    DO UPDATE SET 
      nombre = EXCLUDED.nombre, 
      updated_at = now();
    
    GET DIAGNOSTICS v_processed = ROW_COUNT;
    
  ELSIF v_job_type = 'marcas' THEN
    -- Insert con ON CONFLICT para marcas
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT processed
      LIMIT p_batch_size
    )
    INSERT INTO marcas (user_id, codigo, nombre)
    SELECT 
      v_user_id,
      row_data->>'codigo',
      row_data->>'nombre'
    FROM batch_data
    ON CONFLICT (user_id, codigo) 
    DO UPDATE SET 
      nombre = EXCLUDED.nombre, 
      updated_at = now();
    
    GET DIAGNOSTICS v_processed = ROW_COUNT;
    
  ELSIF v_job_type = 'vendedores' THEN
    -- Insert con ON CONFLICT para vendedores
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT processed
      LIMIT p_batch_size
    )
    INSERT INTO vendedores (user_id, codigo, nombre)
    SELECT 
      v_user_id,
      row_data->>'codigo',
      row_data->>'nombre'
    FROM batch_data
    ON CONFLICT (user_id, codigo) 
    DO UPDATE SET 
      nombre = EXCLUDED.nombre, 
      updated_at = now();
    
    GET DIAGNOSTICS v_processed = ROW_COUNT;
    
  ELSIF v_job_type = 'ventas' THEN
    -- Insert directo para ventas (sin ON CONFLICT porque no hay unique constraint)
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT processed
      LIMIT p_batch_size
    )
    INSERT INTO ventas_reales (user_id, codigo_cliente, codigo_marca, codigo_vendedor, mes, monto)
    SELECT 
      v_user_id,
      row_data->>'codigo_cliente',
      row_data->>'codigo_marca',
      row_data->>'codigo_vendedor',
      row_data->>'mes',
      (row_data->>'monto')::numeric
    FROM batch_data;
    
    GET DIAGNOSTICS v_processed = ROW_COUNT;
  END IF;

  -- Marcar registros como procesados en un solo UPDATE
  UPDATE import_staging
  SET processed = true
  WHERE id IN (
    SELECT id 
    FROM import_staging
    WHERE job_id = p_job_id AND NOT processed
    LIMIT p_batch_size
  );

  -- Actualizar contador del job
  UPDATE import_jobs
  SET 
    processed_rows = processed_rows + v_processed,
    error_count = error_count + v_errors,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$$;

-- Crear índices para optimizar queries si no existen
CREATE INDEX IF NOT EXISTS idx_import_staging_job_processed 
ON import_staging(job_id, processed) 
WHERE NOT processed;

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_status 
ON import_jobs(user_id, status);

-- Índices para búsquedas en tablas principales
CREATE INDEX IF NOT EXISTS idx_clientes_user_codigo ON clientes(user_id, codigo);
CREATE INDEX IF NOT EXISTS idx_marcas_user_codigo ON marcas(user_id, codigo);
CREATE INDEX IF NOT EXISTS idx_vendedores_user_codigo ON vendedores(user_id, codigo);
CREATE INDEX IF NOT EXISTS idx_ventas_user_mes ON ventas_reales(user_id, mes);