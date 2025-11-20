import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";
import * as XLSX from "xlsx";
import LZString from "lz-string";

interface ImportedData {
  clientes?: Array<{ codigo: string; nombre: string }>;
  marcas?: Array<{ codigo: string; nombre: string }>;
  vendedores?: Array<{ codigo: string; nombre: string }>;
  ventas?: Array<{ codigo_cliente: string; codigo_marca: string; codigo_vendedor: string; mes: string; monto: number }>;
  presupuestos?: Array<{ marca: string; fecha_destino: string; empresa: string; presupuesto: number }>;
}

interface DiagnosticResult {
  hasErrors: boolean;
  hasWarnings: boolean;
  duplicatesInFile: number;
  duplicatesInDB: number;
  invalidRows: number;
  totalRows: number;
  missingColumns: string[];
  extraColumns: string[];
}

const CACHE_KEY = 'excel_import_cache';
const DIAGNOSTICS_KEY = 'excel_diagnostics_cache';

export const DataImport = () => {
  const [uploading, setUploading] = useState(false);
  const [importedData, setImportedData] = useState<ImportedData>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [diagnostics, setDiagnostics] = useState<Record<string, DiagnosticResult>>({});

  // Cargar datos de sessionStorage al montar
  useEffect(() => {
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    const cachedDiagnostics = sessionStorage.getItem(DIAGNOSTICS_KEY);
    
    if (cachedData) {
      try {
        // Descomprimir y parsear datos
        const decompressed = LZString.decompressFromUTF16(cachedData);
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          setImportedData(parsed);
          toast.info("Datos recuperados de la sesión anterior");
        }
      } catch (error) {
        console.error("Error recuperando datos de caché:", error);
        sessionStorage.removeItem(CACHE_KEY);
      }
    }
    
    if (cachedDiagnostics) {
      try {
        // Descomprimir y parsear diagnósticos
        const decompressed = LZString.decompressFromUTF16(cachedDiagnostics);
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          setDiagnostics(parsed);
          toast.info("Diagnósticos recuperados de la sesión anterior");
        }
      } catch (error) {
        console.error("Error recuperando diagnósticos de caché:", error);
        sessionStorage.removeItem(DIAGNOSTICS_KEY);
      }
    }
  }, []);

  // Guardar en sessionStorage cuando cambien los datos (con compresión LZ-string)
  useEffect(() => {
    if (Object.keys(importedData).length > 0) {
      try {
        // Comprimir datos antes de guardar
        const jsonString = JSON.stringify(importedData);
        const compressed = LZString.compressToUTF16(jsonString);
        sessionStorage.setItem(CACHE_KEY, compressed);
      } catch (error) {
        // Si falla (QuotaExceededError), simplemente no cachear
        console.warn("No se pudo cachear datos en sessionStorage:", error);
        sessionStorage.removeItem(CACHE_KEY);
      }
    } else {
      sessionStorage.removeItem(CACHE_KEY);
    }
  }, [importedData]);

  // Guardar diagnósticos en sessionStorage (con compresión LZ-string)
  useEffect(() => {
    if (Object.keys(diagnostics).length > 0) {
      try {
        // Comprimir diagnósticos antes de guardar
        const jsonString = JSON.stringify(diagnostics);
        const compressed = LZString.compressToUTF16(jsonString);
        sessionStorage.setItem(DIAGNOSTICS_KEY, compressed);
      } catch (error) {
        console.warn("No se pudo cachear diagnósticos en sessionStorage:", error);
        sessionStorage.removeItem(DIAGNOSTICS_KEY);
      }
    } else {
      sessionStorage.removeItem(DIAGNOSTICS_KEY);
    }
  }, [diagnostics]);

  const downloadTemplate = (type: "clientes" | "marcas" | "vendedores" | "ventas" | "presupuestos") => {
    let data: any[] = [];
    let filename = "";

    switch (type) {
      case "clientes":
        data = [
          { codigo: "C001", nombre: "Cliente Ejemplo 1" },
          { codigo: "C002", nombre: "Cliente Ejemplo 2" },
          { codigo: "C003", nombre: "Cliente Ejemplo 3" }
        ];
        filename = "plantilla_clientes.xlsx";
        break;
      case "marcas":
        data = [
          { codigo: "M001", nombre: "Marca Ejemplo 1" },
          { codigo: "M002", nombre: "Marca Ejemplo 2" },
          { codigo: "M003", nombre: "Marca Ejemplo 3" }
        ];
        filename = "plantilla_marcas.xlsx";
        break;
      case "vendedores":
        data = [
          { codigo: "V001", nombre: "Vendedor Ejemplo 1" },
          { codigo: "V002", nombre: "Vendedor Ejemplo 2" },
          { codigo: "V003", nombre: "Vendedor Ejemplo 3" }
        ];
        filename = "plantilla_vendedores.xlsx";
        break;
      case "ventas":
        data = [
          { codigo_cliente: "C001", codigo_marca: "M001", codigo_vendedor: "V001", mes: "2024/01/31", monto: 15000 },
          { codigo_cliente: "C001", codigo_marca: "M002", codigo_vendedor: "V001", mes: "2024/01/31", monto: 25000 },
          { codigo_cliente: "C002", codigo_marca: "M001", codigo_vendedor: "V002", mes: "2024/01/31", monto: 18000 }
        ];
        filename = "plantilla_ventas.xlsx";
        break;
      case "presupuestos":
        data = [
          { marca: "Nike", fecha_destino: "2025-12-31", empresa: "Empresa Alpha", presupuesto: 100000 },
          { marca: "Adidas", fecha_destino: "2025-12-31", empresa: "Empresa Alpha", presupuesto: 500000 },
          { marca: "Puma", fecha_destino: "2025-12-31", empresa: "Empresa Beta", presupuesto: 125000 }
        ];
        filename = "plantilla_presupuestos.xlsx";
        break;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, filename);
    
    toast.success(`Plantilla ${filename} descargada con nombres de columnas exactos`);
  };

  const validateExcel = (data: any[], type: string): { valid: boolean; missingColumns: string[]; extraColumns: string[] } => {
    console.log('🔍 Validando Excel:', { type, dataLength: data?.length });
    
    if (!data || data.length === 0) {
      console.error('❌ Error: Archivo vacío', { data });
      toast.error("El archivo Excel está vacío");
      return { valid: false, missingColumns: [], extraColumns: [] };
    }

    const requiredFields: Record<string, string[]> = {
      clientes: ["codigo", "nombre"],
      marcas: ["codigo", "nombre"],
      vendedores: ["codigo", "nombre"],
      ventas: ["codigo_cliente", "codigo_marca", "codigo_vendedor", "mes", "monto"],
      presupuestos: ["marca", "fecha_destino", "empresa", "presupuesto"]
    };

    const fields = requiredFields[type];
    if (!fields) {
      console.error('❌ Tipo de archivo no soportado:', type);
      toast.error(`Tipo de archivo "${type}" no soportado`);
      return { valid: false, missingColumns: [], extraColumns: [] };
    }

    const firstRow = data[0];
    console.log('📋 Primera fila del Excel:', firstRow);
    console.log('📋 Columnas esperadas:', fields);
    
    const actualColumns = Object.keys(firstRow);
    console.log('📋 Columnas encontradas:', actualColumns);
    
    const missingColumns = fields.filter(field => !(field in firstRow));
    const extraColumns = actualColumns.filter(col => !fields.includes(col));
    
    if (missingColumns.length > 0) {
      console.error('❌ Faltan columnas:', missingColumns);
      toast.error(`Faltan columnas requeridas: ${missingColumns.join(", ")}`);
      console.log('💡 Sugerencia: Descarga la plantilla correcta y verifica los nombres de las columnas');
      return { valid: false, missingColumns, extraColumns };
    }

    if (extraColumns.length > 0) {
      console.warn('⚠️ Columnas adicionales:', extraColumns);
      toast.warning(`Columnas adicionales detectadas (se ignorarán): ${extraColumns.join(", ")}`);
    }

    console.log('✅ Validación exitosa');
    return { valid: true, missingColumns, extraColumns };
  };

  const runDiagnostics = async (
    data: any[],
    type: "clientes" | "marcas" | "vendedores" | "ventas" | "presupuestos"
  ): Promise<DiagnosticResult> => {
    // Validación simplificada - solo columnas
    const validation = validateExcel(data, type);
    
    // Contar filas inválidas solo en una muestra
    const sampleSize = Math.min(100, data.length);
    let invalidRowsSample = 0;

    for (let i = 0; i < sampleSize; i++) {
      const item = data[i];
      
      if (type === "ventas") {
        if (!item.codigo_cliente || !item.codigo_marca || !item.mes || item.monto === undefined) {
          invalidRowsSample++;
        }
      } else if (type === "presupuestos") {
        if (!item.marca || !item.fecha_destino || !item.empresa || item.presupuesto === undefined) {
          invalidRowsSample++;
        }
      } else {
        const codigo = String(item.codigo || "").trim();
        if (!codigo || !item.nombre) {
          invalidRowsSample++;
        }
      }
    }

    // Extrapolar filas inválidas
    const invalidRows = Math.round((invalidRowsSample / sampleSize) * data.length);

    return {
      hasErrors: !validation.valid || invalidRowsSample > sampleSize * 0.5,
      hasWarnings: invalidRows > 0 || validation.extraColumns.length > 0,
      duplicatesInFile: 0, // No validamos duplicados
      duplicatesInDB: 0, // No validamos duplicados en BD
      invalidRows,
      totalRows: data.length,
      missingColumns: validation.missingColumns,
      extraColumns: validation.extraColumns
    };
  };

  const handleExcelUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "clientes" | "marcas" | "vendedores" | "ventas" | "presupuestos"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log('📁 Cargando archivo:', file.name, 'Tipo:', type);
      toast.loading("Analizando archivo...");
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('📊 Datos parseados del Excel:', jsonData.length, 'filas');
      console.log('📊 Muestra de datos:', jsonData.slice(0, 3));

      if (jsonData.length === 0) {
        console.error('❌ No se encontraron datos en el archivo');
        toast.error("No se encontraron datos válidos en el archivo. Verifica que el archivo tenga datos en la primera hoja.");
        event.target.value = "";
        toast.dismiss();
        return;
      }

      const validation = validateExcel(jsonData, type);
      if (!validation.valid) {
        console.error('❌ Validación fallida');
        event.target.value = "";
        toast.dismiss();
        return;
      }

      // Ejecutar diagnóstico rápido
      const diagnostic = await runDiagnostics(jsonData, type);
      
      const typedData = {
        ...importedData,
        [type]: jsonData
      } as ImportedData;
      setImportedData(typedData);
      
      // Guardar diagnóstico
      setDiagnostics({
        ...diagnostics,
        [type]: diagnostic
      });

      toast.dismiss();
      
      if (diagnostic.hasErrors) {
        toast.error(`Archivo con errores críticos. Verifica las columnas requeridas.`);
      } else if (diagnostic.hasWarnings) {
        toast.warning(`${jsonData.length.toLocaleString()} registros cargados. Validación estimada.`);
      } else {
        toast.success(`${jsonData.length.toLocaleString()} registros listos para importar`);
      }
    } catch (error) {
      console.error("Error reading Excel:", error);
      toast.dismiss();
      toast.error("Error al leer el archivo Excel");
    }
    
    event.target.value = "";
  };

  const normalizeData = (data: any[], type: string) => {
    return data.map(row => {
      const normalized: any = {};
      
      // Normalizar nombres de columnas
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        
        // Mapear variaciones comunes
        const keyMappings: Record<string, string> = {
          'cod': 'codigo',
          'codigo_de_cliente': 'codigo_cliente',
          'codigo_del_cliente': 'codigo_cliente',
          'cliente': 'codigo_cliente',
          'cod_cliente': 'codigo_cliente',
          'codigo_de_marca': 'codigo_marca',
          'marca': 'codigo_marca',
          'cod_marca': 'codigo_marca',
          'codigo_de_vendedor': 'codigo_vendedor',
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
        
        if (value !== null && value !== '') {
          if (finalKey === 'monto') {
            const numValue = String(value).replace(/[^0-9.-]/g, '');
            normalized[finalKey] = numValue;
          } else {
            normalized[finalKey] = String(value).trim();
          }
        }
      }
      
      return normalized;
    });
  };

  const importToDatabase = async (type: "clientes" | "marcas" | "vendedores" | "ventas") => {
    const data = importedData[type];
    if (!data || data.length === 0) {
      toast.error("No hay datos para importar. Primero carga un archivo Excel.");
      return;
    }

    const diagnostic = diagnostics[type];
    if (diagnostic?.hasErrors) {
      toast.error("No se puede importar. Verifica las columnas del archivo.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuario no autenticado");
        setUploading(false);
        return;
      }

      // Normalizar datos en el frontend
      const normalizedData = normalizeData(data, type);
      const totalRows = normalizedData.length;
      
      // Generar ID único para el job
      const jobId = crypto.randomUUID();
      
      toast.success(`Iniciando importación de ${totalRows.toLocaleString()} registros...`);
      setUploadProgress(5);

      // Enviar datos en batches de 3000 registros
      const BATCH_SIZE = 3000;
      const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalRows);
        const batch = normalizedData.slice(start, end);
        
        const isFirstBatch = i === 0;
        const isLastBatch = i === totalBatches - 1;
        
        console.log(`Sending batch ${i + 1}/${totalBatches}: ${batch.length} rows`);
        
        const { error: batchError } = await supabase.functions.invoke('import-data-batch', {
          body: {
            jobId,
            batch,
            isFirstBatch,
            isLastBatch,
            type
          }
        });

        if (batchError) {
          throw new Error(`Error en batch ${i + 1}: ${batchError.message}`);
        }
        
        // Actualizar progreso (5% al 90%)
        const progress = 5 + ((i + 1) / totalBatches) * 85;
        setUploadProgress(Math.floor(progress));
        
        // Pequeña pausa entre batches para no saturar
        if (!isLastBatch) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Esperar a que termine el procesamiento
      toast.info("Procesando datos en la base de datos...");
      setUploadProgress(95);
      
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 30 segundos máximo
      
      while (!processingComplete && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: job } = await supabase
          .from('import_jobs')
          .select('status, success_count, error_count, error_message')
          .eq('id', jobId)
          .single();
        
        if (job) {
          if (job.status === 'completed') {
            processingComplete = true;
            setUploadProgress(100);
            
            const successMsg = job.success_count > 0 
              ? `¡Importación completada! ${job.success_count.toLocaleString()} registros exitosos`
              : 'Importación completada sin registros nuevos';
            
            const errorMsg = job.error_count > 0 
              ? ` (${job.error_count} registros omitidos)` 
              : '';
            
            toast.success(successMsg + errorMsg);
          } else if (job.status === 'failed') {
            throw new Error(job.error_message || 'Error desconocido al procesar');
          }
        }
      }
      
      if (!processingComplete) {
        throw new Error('Tiempo de espera agotado. El procesamiento continúa en segundo plano.');
      }
      
      // Limpiar datos y caché
      const clearedData = { ...importedData };
      delete clearedData[type];
      setImportedData(clearedData);
      
      const clearedDiagnostics = { ...diagnostics };
      delete clearedDiagnostics[type];
      setDiagnostics(clearedDiagnostics);
      
      // Limpiar sessionStorage
      if (Object.keys(clearedData).length === 0) {
        sessionStorage.removeItem(CACHE_KEY);
        sessionStorage.removeItem(DIAGNOSTICS_KEY);
      }

    } catch (error) {
      console.error("Error:", error);
      toast.error(`Error en la importación: ${(error as Error).message}`);
      // Limpiar caché en caso de error
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(DIAGNOSTICS_KEY);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          Importar Datos desde Excel
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Carga archivos Excel para importar clientes, marcas, vendedores, ventas reales y presupuestos sugeridos
        </p>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="marcas">Marcas</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="ventas">Ventas Reales</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          <Alert className="mb-4">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Formato del Excel</AlertTitle>
            <AlertDescription className="space-y-2">
              <p><strong>Columnas requeridas exactas:</strong> <code>codigo</code> y <code>nombre</code></p>
              <p className="text-sm text-muted-foreground">
                Se aceptan variaciones como "Código", "COD", "Nombre del Cliente", etc., pero se recomienda usar la plantilla para evitar errores.
              </p>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("clientes")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientes-file">Archivo Excel de Clientes</Label>
              <p className="text-sm text-muted-foreground">
                El Excel debe contener las columnas: <strong>codigo</strong> y <strong>nombre</strong>
              </p>
              <Input
                id="clientes-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleExcelUpload(e, "clientes")}
                className="cursor-pointer"
              />
            </div>

            {importedData.clientes && importedData.clientes.length > 0 && (
              <div className="space-y-3">
                {diagnostics.clientes && (
                  <Alert variant={diagnostics.clientes.hasErrors ? "destructive" : diagnostics.clientes.hasWarnings ? "default" : "default"} className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Diagnóstico del Archivo</AlertTitle>
                    <AlertDescription className="space-y-1 text-sm">
                      <p><strong>Total de registros:</strong> {diagnostics.clientes.totalRows.toLocaleString()}</p>
                      {diagnostics.clientes.invalidRows > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Filas inválidas estimadas:</strong> ~{diagnostics.clientes.invalidRows.toLocaleString()}</p>
                      )}
                      {diagnostics.clientes.missingColumns.length > 0 && (
                        <p className="text-destructive"><strong>❌ Columnas faltantes:</strong> {diagnostics.clientes.missingColumns.join(", ")}</p>
                      )}
                      {diagnostics.clientes.extraColumns.length > 0 && (
                        <p className="text-muted-foreground"><strong>ℹ️ Columnas extra (se ignorarán):</strong> {diagnostics.clientes.extraColumns.join(", ")}</p>
                      )}
                      {!diagnostics.clientes.hasErrors && !diagnostics.clientes.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Listo para importar</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm font-medium text-foreground">
                  {importedData.clientes.length.toLocaleString()} registros listos para importar
                </p>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Importando al servidor...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => importToDatabase("clientes")}
                  disabled={uploading || diagnostics.clientes?.hasErrors}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Importando..." : "Importar a Base de Datos"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="marcas" className="space-y-4">
          <Alert className="mb-4">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Formato del Excel</AlertTitle>
            <AlertDescription className="space-y-2">
              <p><strong>Columnas requeridas exactas:</strong> <code>codigo</code> y <code>nombre</code></p>
              <p className="text-sm text-muted-foreground">
                Se aceptan variaciones como "Código", "COD", "Nombre de la Marca", etc., pero se recomienda usar la plantilla para evitar errores.
              </p>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("marcas")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marcas-file">Archivo Excel de Marcas</Label>
              <p className="text-sm text-muted-foreground">
                El Excel debe contener las columnas: <strong>codigo</strong> y <strong>nombre</strong>
              </p>
              <Input
                id="marcas-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleExcelUpload(e, "marcas")}
                className="cursor-pointer"
              />
            </div>

            {importedData.marcas && importedData.marcas.length > 0 && (
              <div className="space-y-3">
                {diagnostics.marcas && (
                  <Alert variant={diagnostics.marcas.hasErrors ? "destructive" : diagnostics.marcas.hasWarnings ? "default" : "default"} className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Diagnóstico del Archivo</AlertTitle>
                    <AlertDescription className="space-y-1 text-sm">
                      <p><strong>Total de registros:</strong> {diagnostics.marcas.totalRows.toLocaleString()}</p>
                      {diagnostics.marcas.invalidRows > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Filas inválidas estimadas:</strong> ~{diagnostics.marcas.invalidRows.toLocaleString()}</p>
                      )}
                      {diagnostics.marcas.missingColumns.length > 0 && (
                        <p className="text-destructive"><strong>❌ Columnas faltantes:</strong> {diagnostics.marcas.missingColumns.join(", ")}</p>
                      )}
                      {diagnostics.marcas.extraColumns.length > 0 && (
                        <p className="text-muted-foreground"><strong>ℹ️ Columnas extra (se ignorarán):</strong> {diagnostics.marcas.extraColumns.join(", ")}</p>
                      )}
                      {!diagnostics.marcas.hasErrors && !diagnostics.marcas.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Listo para importar</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm font-medium text-foreground">
                  {importedData.marcas.length.toLocaleString()} registros listos para importar
                </p>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Importando al servidor...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => importToDatabase("marcas")}
                  disabled={uploading || diagnostics.marcas?.hasErrors}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Importando..." : "Importar a Base de Datos"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vendedores" className="space-y-4">
          <Alert className="mb-4">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Formato del Excel</AlertTitle>
            <AlertDescription className="space-y-2">
              <p><strong>Columnas requeridas exactas:</strong> <code>codigo</code> y <code>nombre</code></p>
              <p className="text-sm text-muted-foreground">
                Se aceptan variaciones como "Código", "COD", "Nombre del Vendedor", etc., pero se recomienda usar la plantilla para evitar errores.
              </p>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("vendedores")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendedores-file">Archivo Excel de Vendedores</Label>
              <p className="text-sm text-muted-foreground">
                El Excel debe contener las columnas: <strong>codigo</strong> y <strong>nombre</strong>
              </p>
              <Input
                id="vendedores-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleExcelUpload(e, "vendedores")}
                className="cursor-pointer"
              />
            </div>

            {importedData.vendedores && importedData.vendedores.length > 0 && (
              <div className="space-y-3">
                {diagnostics.vendedores && (
                  <Alert variant={diagnostics.vendedores.hasErrors ? "destructive" : diagnostics.vendedores.hasWarnings ? "default" : "default"} className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Diagnóstico del Archivo</AlertTitle>
                    <AlertDescription className="space-y-1 text-sm">
                      <p><strong>Total de registros:</strong> {diagnostics.vendedores.totalRows.toLocaleString()}</p>
                      {diagnostics.vendedores.invalidRows > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Filas inválidas estimadas:</strong> ~{diagnostics.vendedores.invalidRows.toLocaleString()}</p>
                      )}
                      {diagnostics.vendedores.missingColumns.length > 0 && (
                        <p className="text-destructive"><strong>❌ Columnas faltantes:</strong> {diagnostics.vendedores.missingColumns.join(", ")}</p>
                      )}
                      {diagnostics.vendedores.extraColumns.length > 0 && (
                        <p className="text-muted-foreground"><strong>ℹ️ Columnas extra (se ignorarán):</strong> {diagnostics.vendedores.extraColumns.join(", ")}</p>
                      )}
                      {!diagnostics.vendedores.hasErrors && !diagnostics.vendedores.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Listo para importar</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm font-medium text-foreground">
                  {importedData.vendedores.length.toLocaleString()} registros listos para importar
                </p>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Importando al servidor...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => importToDatabase("vendedores")}
                  disabled={uploading || diagnostics.vendedores?.hasErrors}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Importando..." : "Importar a Base de Datos"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ventas" className="space-y-4">
          <Alert className="mb-4">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Formato del Excel</AlertTitle>
            <AlertDescription className="space-y-2">
              <p><strong>Columnas requeridas exactas:</strong> <code>codigo_cliente</code>, <code>codigo_marca</code>, <code>codigo_vendedor</code>, <code>mes</code> y <code>monto</code></p>
              <p className="text-sm text-muted-foreground">
                Se aceptan variaciones como "Cliente", "Marca", "Vendedor", "Fecha", "Importe", etc., pero se recomienda usar la plantilla.
              </p>
              <p className="text-sm font-medium text-amber-600">
                ⚠️ <strong>Importante:</strong> Debe importar primero Clientes, Marcas y Vendedores antes de importar Ventas Reales.
              </p>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("ventas")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ventas-file">Archivo Excel de Ventas Reales</Label>
              <p className="text-sm text-muted-foreground">
                El Excel debe contener las columnas: <strong>codigo_cliente</strong>, <strong>codigo_marca</strong>, 
                <strong> codigo_vendedor</strong>, <strong>mes</strong> y <strong>monto</strong>
              </p>
              <Input
                id="ventas-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleExcelUpload(e, "ventas")}
                className="cursor-pointer"
              />
            </div>

            {importedData.ventas && importedData.ventas.length > 0 && (
              <div className="space-y-3">
                {diagnostics.ventas && (
                  <Alert variant={diagnostics.ventas.hasErrors ? "destructive" : diagnostics.ventas.hasWarnings ? "default" : "default"} className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Diagnóstico del Archivo</AlertTitle>
                    <AlertDescription className="space-y-1 text-sm">
                      <p><strong>Total de registros:</strong> {diagnostics.ventas.totalRows.toLocaleString()}</p>
                      {diagnostics.ventas.invalidRows > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Filas inválidas estimadas:</strong> ~{diagnostics.ventas.invalidRows.toLocaleString()}</p>
                      )}
                      {diagnostics.ventas.missingColumns.length > 0 && (
                        <p className="text-destructive"><strong>❌ Columnas faltantes:</strong> {diagnostics.ventas.missingColumns.join(", ")}</p>
                      )}
                      {diagnostics.ventas.extraColumns.length > 0 && (
                        <p className="text-muted-foreground"><strong>ℹ️ Columnas extra (se ignorarán):</strong> {diagnostics.ventas.extraColumns.join(", ")}</p>
                      )}
                      {!diagnostics.ventas.hasErrors && !diagnostics.ventas.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Listo para importar</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm font-medium text-foreground">
                  {importedData.ventas.length.toLocaleString()} registros listos para importar
                </p>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Importando al servidor...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
                <Button
                  onClick={() => importToDatabase("ventas")}
                  disabled={uploading || diagnostics.ventas?.hasErrors}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Importando..." : "Importar a Base de Datos"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="presupuestos" className="space-y-4">
          <Alert className="mb-4">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Formato del Excel - Presupuestos</AlertTitle>
            <AlertDescription className="space-y-2">
              <p><strong>Columnas requeridas exactas:</strong> <code>marca</code>, <code>fecha_destino</code>, <code>empresa</code> y <code>presupuesto</code></p>
              <p className="text-sm text-muted-foreground">
                Este formato permite importar presupuestos sugeridos directamente desde Excel.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>fecha_destino:</strong> Formato YYYY-MM-DD (ej: 2025-12-31)
              </p>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("presupuestos")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="presupuestos-file">Archivo Excel de Presupuestos</Label>
              <p className="text-sm text-muted-foreground">
                El Excel debe contener las columnas: <strong>marca</strong>, <strong>fecha_destino</strong>, <strong>empresa</strong> y <strong>presupuesto</strong>
              </p>
              <Input
                id="presupuestos-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleExcelUpload(e, "presupuestos")}
                className="cursor-pointer"
              />
            </div>

            {importedData.presupuestos && importedData.presupuestos.length > 0 && (
              <div className="space-y-3">
                {diagnostics.presupuestos && (
                  <Alert variant={diagnostics.presupuestos.hasErrors ? "destructive" : diagnostics.presupuestos.hasWarnings ? "default" : "default"} className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Diagnóstico del Archivo</AlertTitle>
                    <AlertDescription className="space-y-1 text-sm">
                      <p><strong>Total de registros:</strong> {diagnostics.presupuestos.totalRows.toLocaleString()}</p>
                      {diagnostics.presupuestos.invalidRows > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Filas inválidas estimadas:</strong> ~{diagnostics.presupuestos.invalidRows.toLocaleString()}</p>
                      )}
                      {diagnostics.presupuestos.missingColumns.length > 0 && (
                        <p className="text-destructive"><strong>❌ Columnas faltantes:</strong> {diagnostics.presupuestos.missingColumns.join(", ")}</p>
                      )}
                      {diagnostics.presupuestos.extraColumns.length > 0 && (
                        <p className="text-muted-foreground"><strong>ℹ️ Columnas extra (se ignorarán):</strong> {diagnostics.presupuestos.extraColumns.join(", ")}</p>
                      )}
                      {!diagnostics.presupuestos.hasErrors && !diagnostics.presupuestos.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Presupuestos validados correctamente</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm font-medium text-foreground">
                  {importedData.presupuestos.length.toLocaleString()} presupuestos listos
                </p>
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-700">
                    ✅ Los presupuestos están cargados y listos. Ve a la pestaña "Parámetros" para ver la distribución automática por marca, vendedor, cliente y artículo.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
