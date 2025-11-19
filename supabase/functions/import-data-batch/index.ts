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

    const { jobId, batch, isFirstBatch, isLastBatch, type } = await req.json();

    if (!jobId || !batch || !Array.isArray(batch) || !type) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${jobId}] Received batch: ${batch.length} rows, first=${isFirstBatch}, last=${isLastBatch}`);

    // Si es el primer batch, crear el job
    if (isFirstBatch) {
      const { error: jobError } = await supabaseClient
        .from('import_jobs')
        .insert({
          id: jobId,
          user_id: user.id,
          type: type,
          status: 'processing',
          total_rows: 0 // Se actualizará con cada batch
        });

      if (jobError) {
        console.error('Error creating job:', jobError);
        return new Response(
          JSON.stringify({ error: 'Error creando trabajo de importación' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insertar batch en staging
    const stagingBatch = batch.map((item: any) => ({
      job_id: jobId,
      row_data: item
    }));

    const { error: stagingError } = await supabaseClient
      .from('import_staging')
      .insert(stagingBatch);

    if (stagingError) {
      console.error(`[${jobId}] Error inserting batch:`, stagingError);
      return new Response(
        JSON.stringify({ error: 'Error insertando datos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar total_rows en el job
    await supabaseClient
      .from('import_jobs')
      .update({ 
        total_rows: supabaseClient.rpc('increment_total_rows', { job_id: jobId, increment: batch.length })
      })
      .eq('id', jobId);

    console.log(`[${jobId}] Batch inserted successfully: ${batch.length} rows`);

    // Si es el último batch, iniciar procesamiento en background
    if (isLastBatch) {
      console.log(`[${jobId}] Last batch received, starting processing`);
      
      // Responder inmediatamente al cliente
      const response = new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Procesamiento iniciado',
          jobId 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

      // Procesar en background sin bloquear la respuesta
      (async () => {
        try {
          let hasMore = true;
          const PROCESS_BATCH_SIZE = 500; // Reducir a 500 para evitar timeouts

          while (hasMore) {
            const { data: result, error } = await supabaseClient
              .rpc('process_import_batch', {
                p_job_id: jobId,
                p_batch_size: PROCESS_BATCH_SIZE
              });

            if (error) {
              console.error(`[${jobId}] Error processing:`, error);
              await supabaseClient
                .from('import_jobs')
                .update({ 
                  status: 'failed',
                  error_message: error.message 
                })
                .eq('id', jobId);
              break;
            }

            const processed = result[0]?.processed || 0;
            hasMore = processed > 0;
            
            console.log(`[${jobId}] Processed ${processed} rows`);
            
            // Pequeña pausa para liberar recursos
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Marcar como completado
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
            
          console.log(`[${jobId}] Processing completed and cleaned up`);
        } catch (bgError) {
          console.error(`[${jobId}] Background processing error:`, bgError);
          await supabaseClient
            .from('import_jobs')
            .update({ 
              status: 'failed',
              error_message: String(bgError)
            })
            .eq('id', jobId);
        }
      })();

      return response;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
