-- Drop and recreate process_import_batch with correct return column names
DROP FUNCTION IF EXISTS public.process_import_batch(uuid, integer);

CREATE FUNCTION public.process_import_batch(p_job_id uuid, p_batch_size integer DEFAULT 2000)
RETURNS TABLE(processed integer, errors integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job_type TEXT;
  v_user_id UUID;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Get job info
  SELECT type, user_id INTO v_job_type, v_user_id
  FROM import_jobs WHERE id = p_job_id;

  IF v_job_type IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  -- Process based on type with bulk inserts and deduplication
  IF v_job_type = 'clientes' THEN
    -- Deduplicate and insert clientes
    WITH batch_data AS (
      SELECT DISTINCT ON (row_data->>'codigo')
        id, 
        row_data->>'codigo' as codigo,
        row_data->>'nombre' as nombre
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      ORDER BY row_data->>'codigo', id
      LIMIT p_batch_size
    )
    INSERT INTO clientes (user_id, codigo, nombre)
    SELECT 
      v_user_id,
      codigo,
      nombre
    FROM batch_data
    ON CONFLICT (user_id, codigo) 
    DO UPDATE SET 
      nombre = EXCLUDED.nombre, 
      updated_at = now();
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'marcas' THEN
    -- Deduplicate and insert marcas
    WITH batch_data AS (
      SELECT DISTINCT ON (row_data->>'codigo')
        id,
        row_data->>'codigo' as codigo,
        row_data->>'nombre' as nombre
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      ORDER BY row_data->>'codigo', id
      LIMIT p_batch_size
    )
    INSERT INTO marcas (user_id, codigo, nombre)
    SELECT 
      v_user_id,
      codigo,
      nombre
    FROM batch_data
    ON CONFLICT (user_id, codigo) 
    DO UPDATE SET 
      nombre = EXCLUDED.nombre, 
      updated_at = now();
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'vendedores' THEN
    -- Deduplicate and insert vendedores
    WITH batch_data AS (
      SELECT DISTINCT ON (row_data->>'codigo')
        id,
        row_data->>'codigo' as codigo,
        row_data->>'nombre' as nombre
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
      ORDER BY row_data->>'codigo', id
      LIMIT p_batch_size
    )
    INSERT INTO vendedores (user_id, codigo, nombre)
    SELECT 
      v_user_id,
      codigo,
      nombre
    FROM batch_data
    ON CONFLICT (user_id, codigo) 
    DO UPDATE SET 
      nombre = EXCLUDED.nombre, 
      updated_at = now();
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'ventas' THEN
    -- Insert ventas with validation
    WITH batch_data AS (
      SELECT 
        id,
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
    SELECT 
      v_user_id,
      codigo_cliente,
      codigo_marca,
      codigo_vendedor,
      mes,
      monto
    FROM validated_data;
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
    -- Count errors
    SELECT (p_batch_size - v_processed) INTO v_errors;
  END IF;

  -- Mark records as processed
  UPDATE import_staging
  SET processed = true
  WHERE id IN (
    SELECT id 
    FROM import_staging
    WHERE job_id = p_job_id AND NOT import_staging.processed
    LIMIT p_batch_size
  );

  -- Update job counters
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