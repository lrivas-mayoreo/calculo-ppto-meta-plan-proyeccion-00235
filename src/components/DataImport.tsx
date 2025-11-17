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

  const downloadTemplate = (type: "clientes" | "marcas" | "vendedores" | "ventas") => {
    let data: any[] = [];
    let filename = "";

    switch (type) {
      case "clientes":
        data = [{ codigo: "CLI001", nombre: "Cliente Ejemplo" }];
        filename = "plantilla_clientes.xlsx";
        break;
      case "marcas":
        data = [{ codigo: "MAR001", nombre: "Marca Ejemplo" }];
        filename = "plantilla_marcas.xlsx";
        break;
      case "vendedores":
        data = [{ codigo: "VEN001", nombre: "Vendedor Ejemplo" }];
        filename = "plantilla_vendedores.xlsx";
        break;
      case "ventas":
        data = [{ codigo_cliente: "CLI001", codigo_marca: "MAR001", codigo_vendedor: "VEN001", mes: "enero-2025", monto: 10000 }];
        filename = "plantilla_ventas.xlsx";
        break;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, filename);
  };

  const validateExcel = (data: any[], type: string): { valid: boolean; missingColumns: string[]; extraColumns: string[] } => {
    if (!data || data.length === 0) {
      toast.error("El archivo Excel está vacío");
      return { valid: false, missingColumns: [], extraColumns: [] };
    }

    const requiredFields: Record<string, string[]> = {
      clientes: ["codigo", "nombre"],
      marcas: ["codigo", "nombre"],
      vendedores: ["codigo", "nombre"],
      ventas: ["codigo_cliente", "codigo_marca", "codigo_vendedor", "mes", "monto"]
    };

    const fields = requiredFields[type];
    const firstRow = data[0];
    const actualColumns = Object.keys(firstRow);
    
    const missingColumns = fields.filter(field => !(field in firstRow));
    const extraColumns = actualColumns.filter(col => !fields.includes(col));
    
    if (missingColumns.length > 0) {
      toast.error(`Faltan columnas requeridas: ${missingColumns.join(", ")}`);
      return { valid: false, missingColumns, extraColumns };
    }

    if (extraColumns.length > 0) {
      toast.warning(`Columnas adicionales detectadas (se ignorarán): ${extraColumns.join(", ")}`);
    }

    return { valid: true, missingColumns, extraColumns };
  };

  const runDiagnostics = async (
    data: any[],
    type: "clientes" | "marcas" | "vendedores" | "ventas"
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
    type: "clientes" | "marcas" | "vendedores" | "ventas"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      toast.loading("Analizando archivo...");
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const validation = validateExcel(jsonData, type);
      if (!validation.valid) {
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

      // Crear el archivo Excel original para enviarlo al backend
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Datos");
      const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Enviar al edge function (solo carga a staging)
      const formData = new FormData();
      formData.append('file', blob, `${type}.xlsx`);
      formData.append('type', type);

      setUploadProgress(10);

      const response = await supabase.functions.invoke('bulk-import', {
        body: formData,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success || !result.jobId) {
        throw new Error('Error iniciando importación');
      }

      const jobId = result.jobId;
      const totalRows = result.totalRows;
      toast.success(`Datos cargados: ${totalRows.toLocaleString()} registros. Procesando...`);
      
      setUploadProgress(20);

      // Procesar lotes hasta completar
      let hasMore = true;
      let attempts = 0;
      const maxAttempts = 200; // Máximo de lotes

      while (hasMore && attempts < maxAttempts) {
        attempts++;

        const { data: batchResult, error: batchError } = await supabase.functions.invoke('process-import-batch', {
          body: { jobId, batchSize: 3000 }
        });

        if (batchError) {
          throw new Error(`Error procesando lote: ${batchError.message}`);
        }

        hasMore = batchResult.hasMore;

        // Actualizar progreso basado en el job
        const { data: job } = await supabase
          .from('import_jobs')
          .select('processed_rows, total_rows, status')
          .eq('id', jobId)
          .single();

        if (job) {
          if (job.status === 'failed') {
            throw new Error('El procesamiento falló en el servidor');
          }
          
          const progress = 20 + (job.processed_rows / job.total_rows) * 75;
          setUploadProgress(Math.min(Math.floor(progress), 99));
        }

        // Pequeña pausa
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error('Se alcanzó el límite de lotes. Por favor, contacta soporte.');
      }

      // Verificar resultado final
      const { data: finalJob } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (finalJob?.status === 'completed') {
        setUploadProgress(100);
        
        const successMsg = finalJob.success_count > 0 
          ? `¡Importación completada! ${finalJob.success_count.toLocaleString()} registros exitosos`
          : 'Importación completada sin registros nuevos';
        
        const errorMsg = finalJob.error_count > 0 
          ? ` (${finalJob.error_count} registros omitidos por errores de validación)` 
          : '';
        
        toast.success(successMsg + errorMsg);
        
        // Limpiar datos y caché
        const clearedData = { ...importedData };
        delete clearedData[type];
        setImportedData(clearedData);
        
        const clearedDiagnostics = { ...diagnostics };
        delete clearedDiagnostics[type];
        setDiagnostics(clearedDiagnostics);
        
        // Limpiar sessionStorage para este tipo
        if (Object.keys(clearedData).length === 0) {
          sessionStorage.removeItem(CACHE_KEY);
          sessionStorage.removeItem(DIAGNOSTICS_KEY);
        }
      } else {
        throw new Error(finalJob?.error_message || 'Error desconocido al procesar');
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
          Carga archivos Excel para importar clientes, marcas, vendedores y ventas reales
        </p>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="marcas">Marcas</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="ventas">Ventas Reales</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
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
      </Tabs>
    </Card>
  );
};
