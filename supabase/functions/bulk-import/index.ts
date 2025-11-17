import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Declarar EdgeRuntime global
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
} | undefined;

// Log cuando el runtime está cerrándose
addEventListener('beforeunload', (ev: any) => {
  console.log('Edge function shutting down:', ev.detail?.reason);
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file || !type) {
      return new Response(
        JSON.stringify({ error: 'Falta archivo o tipo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${type} file: ${file.name}, size: ${file.size} bytes`);

    // Leer archivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      dense: true,
      raw: false
    });
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false
    });

    console.log(`Parsed ${jsonData.length} rows from Excel`);
    
    // Normalizar nombres de columnas y validar campos requeridos
    const normalizedData = normalizeAndValidateData(jsonData, type);
    
    if (normalizedData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `No se encontraron columnas válidas. Campos esperados: ${getExpectedColumns(type).join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Normalized ${normalizedData.length} valid rows`);

    if (!jsonData || jsonData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'El archivo está vacío' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear job de importación
    const { data: job, error: jobError } = await supabaseClient
      .from('import_jobs')
      .insert({
        user_id: user.id,
        type: type,
        status: 'pending',
        total_rows: normalizedData.length
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Error creating job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Error creando trabajo de importación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created job ${job.id} for ${normalizedData.length} rows`);

    // Iniciar procesamiento en background con waitUntil para que el runtime espere
    const backgroundTask = insertAndProcessData(supabaseClient, job.id, normalizedData, type, user.id);
    
    // Usar EdgeRuntime.waitUntil para asegurar que la tarea termine antes de cerrar
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask);
      console.log('Background task registered with EdgeRuntime.waitUntil');
    } else {
      // Fallback: esperar la tarea si waitUntil no está disponible
      console.warn('EdgeRuntime.waitUntil not available, awaiting task directly');
      await backgroundTask;
    }

    // Respuesta inmediata al cliente
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        totalRows: normalizedData.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing import:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Insertar en staging y procesar en background
async function insertAndProcessData(
  supabase: any,
  jobId: string,
  jsonData: any[],
  type: string,
  userId: string
) {
  try {
    console.log(`[${jobId}] Starting data insertion for job with ${jsonData.length} rows`);

    // Insertar en staging en lotes grandes (10K por lote para reducir round-trips)
    const STAGING_BATCH_SIZE = 10000;
    let totalInserted = 0;
    
    for (let i = 0; i < jsonData.length; i += STAGING_BATCH_SIZE) {
      const batch = jsonData.slice(i, i + STAGING_BATCH_SIZE);
      const stagingBatch = batch.map((item: any) => ({
        job_id: jobId,
        row_data: item
      }));

      console.log(`[${jobId}] Attempting to insert batch ${Math.floor(i / STAGING_BATCH_SIZE) + 1}, rows ${i}-${Math.min(i + STAGING_BATCH_SIZE, jsonData.length)}`);

      const { error: stagingError, count } = await supabase
        .from('import_staging')
        .insert(stagingBatch)
        .select('id', { count: 'exact', head: true });

      if (stagingError) {
        console.error(`[${jobId}] Error inserting staging batch:`, stagingError);
        throw stagingError;
      }
      
      totalInserted += batch.length;
      console.log(`[${jobId}] Successfully inserted batch ${Math.floor(i / STAGING_BATCH_SIZE) + 1}, total: ${totalInserted}/${jsonData.length} rows`);
    }

    console.log(`[${jobId}] All ${totalInserted} rows inserted to staging, starting processing`);

    // Actualizar estado a processing
    await supabase
      .from('import_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Procesar en lotes desde staging a tablas finales
    let hasMore = true;
    const PROCESS_BATCH_SIZE = 2000; // Lotes más grandes para procesar más rápido

    while (hasMore) {
      const { data: result, error } = await supabase
        .rpc('process_import_batch', {
          p_job_id: jobId,
          p_batch_size: PROCESS_BATCH_SIZE
        });

      if (error) {
        console.error('Error processing batch:', error);
        await supabase
          .from('import_jobs')
          .update({ 
            status: 'failed',
            error_message: error.message 
          })
          .eq('id', jobId);
        return;
      }

      const processed = result[0]?.processed || 0;
      hasMore = processed > 0;

      console.log(`Processed ${processed} records for job ${jobId}`);
    }

    // Marcar como completado
    const { data: finalJob } = await supabase
      .from('import_jobs')
      .select('processed_rows, error_count')
      .eq('id', jobId)
      .single();

    await supabase
      .from('import_jobs')
      .update({ 
        status: 'completed',
        success_count: finalJob.processed_rows - finalJob.error_count
      })
      .eq('id', jobId);

    // Limpiar staging
    await supabase
      .from('import_staging')
      .delete()
      .eq('job_id', jobId);

    console.log(`Job ${jobId} completed successfully`);

  } catch (error) {
    console.error('Error in background processing:', error);
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'failed',
        error_message: String(error)
      })
      .eq('id', jobId);
  }
}

// Funciones auxiliares para normalización y validación
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function getExpectedColumns(type: string): string[] {
  const columns: Record<string, string[]> = {
    clientes: ['codigo', 'nombre'],
    marcas: ['codigo', 'nombre'],
    vendedores: ['codigo', 'nombre'],
    ventas: ['codigo_cliente', 'codigo_marca', 'codigo_vendedor', 'mes', 'monto']
  };
  return columns[type] || [];
}

function normalizeAndValidateData(data: any[], type: string): any[] {
  if (!data || data.length === 0) return [];
  
  const expectedColumns = getExpectedColumns(type);
  const normalized: any[] = [];
  
  for (const row of data) {
    const normalizedRow: any = {};
    let hasAllRequired = true;
    
    // Mapear columnas del Excel a nombres normalizados
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeColumnName(key as string);
      
      // Mapear variaciones comunes
      const keyMappings: Record<string, string> = {
        'cod': 'codigo',
        'codigo_de_cliente': 'codigo_cliente',
        'codigo_del_cliente': 'codigo_cliente',
        'cliente': 'codigo_cliente',
        'cod_cliente': 'codigo_cliente',
        'codigo_de_marca': 'codigo_marca',
        'codigo_de_la_marca': 'codigo_marca',
        'marca': 'codigo_marca',
        'cod_marca': 'codigo_marca',
        'codigo_de_vendedor': 'codigo_vendedor',
        'codigo_del_vendedor': 'codigo_vendedor',
        'vendedor': 'codigo_vendedor',
        'cod_vendedor': 'codigo_vendedor',
        'nombre_del_cliente': 'nombre',
        'nombre_de_la_marca': 'nombre',
        'nombre_del_vendedor': 'nombre',
        'razon_social': 'nombre',
        'descripcion': 'nombre',
        'fecha': 'mes',
        'periodo': 'mes',
        'importe': 'monto',
        'valor': 'monto',
        'venta': 'monto',
        'total': 'monto'
      };
      
      const finalKey = keyMappings[normalizedKey] || normalizedKey;
      
      if (expectedColumns.includes(finalKey)) {
        // Validar y convertir tipos según sea necesario
        if (finalKey === 'monto' && value !== null && value !== '') {
          // Convertir monto a número, eliminar caracteres no numéricos
          const numValue = String(value).replace(/[^0-9.-]/g, '');
          normalizedRow[finalKey] = numValue;
        } else if (value !== null && value !== '') {
          normalizedRow[finalKey] = String(value).trim();
        }
      }
    }
    
    // Verificar que tenga todos los campos requeridos
    for (const col of expectedColumns) {
      if (col !== 'codigo_vendedor' && !normalizedRow[col]) { // codigo_vendedor es opcional
        hasAllRequired = false;
        break;
      }
    }
    
    if (hasAllRequired) {
      normalized.push(normalizedRow);
    }
  }
  
  return normalized;
}
