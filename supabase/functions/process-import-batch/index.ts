import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    const { jobId, batchSize = 3000 } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Falta jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch for job ${jobId} with batch size ${batchSize}`);

    // Llamar a la función SQL para procesar un lote
    const { data: result, error } = await supabaseClient
      .rpc('process_import_batch', {
        p_job_id: jobId,
        p_batch_size: batchSize
      });

    if (error) {
      console.error('Error processing batch:', error);
      
      // Marcar job como fallido
      await supabaseClient
        .from('import_jobs')
        .update({ 
          status: 'failed',
          error_message: error.message 
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processed = result[0]?.processed || 0;
    const errors = result[0]?.errors || 0;

    console.log(`Processed ${processed} records, ${errors} errors for job ${jobId}`);

    // Verificar si hay más datos por procesar
    const { count } = await supabaseClient
      .from('import_staging')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('processed', false);

    const hasMore = (count || 0) > 0;

    // Si no hay más, marcar como completado
    if (!hasMore) {
      const { data: finalJob } = await supabaseClient
        .from('import_jobs')
        .select('processed_rows, error_count')
        .eq('id', jobId)
        .single();

      if (finalJob) {
        await supabaseClient
          .from('import_jobs')
          .update({ 
            status: 'completed',
            success_count: finalJob.processed_rows - finalJob.error_count
          })
          .eq('id', jobId);
      }

      // Limpiar staging
      await supabaseClient
        .from('import_staging')
        .delete()
        .eq('job_id', jobId);

      console.log(`Job ${jobId} completed successfully`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        hasMore
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in process-import-batch:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
