import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        total_rows: jsonData.length
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

    console.log(`Created job ${job.id} for ${jsonData.length} rows`);

    // Insertar datos en staging en lotes
    const BATCH_SIZE = 5000;
    let stagingInserted = 0;

    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);
      const stagingBatch = batch.map((item: any) => ({
        job_id: job.id,
        row_data: item
      }));

      const { error: stagingError } = await supabaseClient
        .from('import_staging')
        .insert(stagingBatch);

      if (stagingError) {
        console.error('Error inserting staging batch:', stagingError);
      } else {
        stagingInserted += batch.length;
      }
    }

    console.log(`Inserted ${stagingInserted} rows into staging`);

    // Iniciar procesamiento en background (no await)
    processImportJob(supabaseClient, job.id, type, user.id);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        totalRows: jsonData.length
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

// Procesar job en background
async function processImportJob(
  supabase: any,
  jobId: string,
  type: string,
  userId: string
) {
  try {
    console.log(`Starting background processing for job ${jobId}`);

    await supabase
      .from('import_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Procesar en lotes usando la función de base de datos
    let hasMore = true;
    const BATCH_SIZE = 1000;

    while (hasMore) {
      const { data: result, error } = await supabase
        .rpc('process_import_batch', {
          p_job_id: jobId,
          p_batch_size: BATCH_SIZE
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
