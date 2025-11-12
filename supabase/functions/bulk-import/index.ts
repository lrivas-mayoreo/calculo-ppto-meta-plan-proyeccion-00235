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
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Parsed ${jsonData.length} rows from Excel`);

    if (!jsonData || jsonData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'El archivo está vacío' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar datos para inserción
    let dataToInsert: any[] = [];
    let tableName = '';

    switch (type) {
      case 'clientes':
        tableName = 'clientes';
        dataToInsert = jsonData.map((item: any) => ({
          user_id: user.id,
          codigo: String(item.codigo || '').trim(),
          nombre: String(item.nombre || '').trim()
        })).filter(item => item.codigo && item.nombre);
        break;

      case 'marcas':
        tableName = 'marcas';
        dataToInsert = jsonData.map((item: any) => ({
          user_id: user.id,
          codigo: String(item.codigo || '').trim(),
          nombre: String(item.nombre || '').trim()
        })).filter(item => item.codigo && item.nombre);
        break;

      case 'vendedores':
        tableName = 'vendedores';
        dataToInsert = jsonData.map((item: any) => ({
          user_id: user.id,
          codigo: String(item.codigo || '').trim(),
          nombre: String(item.nombre || '').trim()
        })).filter(item => item.codigo && item.nombre);
        break;

      case 'ventas':
        tableName = 'ventas_reales';
        dataToInsert = jsonData.map((item: any) => ({
          user_id: user.id,
          codigo_cliente: String(item.codigo_cliente || '').trim(),
          codigo_marca: String(item.codigo_marca || '').trim(),
          codigo_vendedor: item.codigo_vendedor ? String(item.codigo_vendedor).trim() : null,
          mes: String(item.mes || '').trim(),
          monto: parseFloat(item.monto || 0)
        })).filter(item => item.codigo_cliente && item.codigo_marca && item.mes && !isNaN(item.monto));
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Tipo inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Prepared ${dataToInsert.length} valid records for insertion`);

    // Procesar en lotes grandes (5000 registros por lote)
    const BATCH_SIZE = 5000;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataToInsert.length; i += BATCH_SIZE) {
      const batch = dataToInsert.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(dataToInsert.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)`);

      try {
        let result;
        
        if (type === 'ventas') {
          // Para ventas usar insert directo
          result = await supabaseClient
            .from(tableName)
            .insert(batch);
        } else {
          // Para otros tipos usar upsert
          result = await supabaseClient
            .from(tableName)
            .upsert(batch, {
              onConflict: 'user_id,codigo',
              ignoreDuplicates: false
            });
        }

        if (result.error) {
          console.error(`Error in batch ${batchNum}:`, result.error);
          errorCount += batch.length;
          errors.push(`Lote ${batchNum}: ${result.error.message}`);
        } else {
          successCount += batch.length;
          console.log(`Batch ${batchNum} completed successfully`);
        }
      } catch (error) {
        console.error(`Exception in batch ${batchNum}:`, error);
        errorCount += batch.length;
        errors.push(`Lote ${batchNum}: ${(error as Error).message || String(error)}`);
      }
    }

    console.log(`Import completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        totalRows: jsonData.length,
        validRows: dataToInsert.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
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
