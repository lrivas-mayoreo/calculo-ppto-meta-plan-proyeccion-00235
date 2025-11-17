-- Fix ambiguous column reference in process_import_batch function
CREATE OR REPLACE FUNCTION public.process_import_batch(p_job_id uuid, p_batch_size integer DEFAULT 2000)
RETURNS TABLE(processed_count integer, error_count integer)
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

  -- Process based on type with bulk inserts
  IF v_job_type = 'clientes' THEN
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
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
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'marcas' THEN
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
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
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'vendedores' THEN
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
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
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
    
  ELSIF v_job_type = 'ventas' THEN
    WITH batch_data AS (
      SELECT id, row_data
      FROM import_staging
      WHERE job_id = p_job_id AND NOT import_staging.processed
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
    
    GET DIAGNOSTICS v_processed := ROW_COUNT;
  END IF;

  -- Mark records as processed in a single UPDATE
  UPDATE import_staging
  SET processed = true
  WHERE id IN (
    SELECT id 
    FROM import_staging
    WHERE job_id = p_job_id AND NOT import_staging.processed
    LIMIT p_batch_size
  );

  -- Update job counter with explicit table qualification to avoid ambiguity
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