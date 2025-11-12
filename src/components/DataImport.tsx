import { useState } from "react";
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

export const DataImport = () => {
  const [uploading, setUploading] = useState(false);
  const [importedData, setImportedData] = useState<ImportedData>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [diagnostics, setDiagnostics] = useState<Record<string, DiagnosticResult>>({});

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        hasErrors: true,
        hasWarnings: false,
        duplicatesInFile: 0,
        duplicatesInDB: 0,
        invalidRows: 0,
        totalRows: data.length,
        missingColumns: [],
        extraColumns: []
      };
    }

    // Validar columnas
    const validation = validateExcel(data, type);
    
    // Detectar duplicados de código en el archivo (solo códigos, nombre puede repetirse)
    const codigosInFile = new Set<string>();
    let duplicatesInFile = 0;
    let invalidRows = 0;

    for (const item of data) {
      // Para ventas, validar campos requeridos
      if (type === "ventas") {
        if (!item.codigo_cliente || !item.codigo_marca || !item.mes || item.monto === undefined) {
          invalidRows++;
          continue;
        }
        // Para ventas no contamos duplicados de código
        continue;
      }
      
      // Para clientes, marcas, vendedores
      const codigo = String(item.codigo || "").trim();
      
      if (!codigo) {
        invalidRows++;
        continue;
      }

      if (!item.nombre) {
        invalidRows++;
        continue;
      }

      // Contar duplicados de código en el archivo (nombre puede repetirse)
      if (codigosInFile.has(codigo)) {
        duplicatesInFile++;
      } else {
        codigosInFile.add(codigo);
      }
    }

    // Los duplicados en BD se manejarán con upsert, solo informamos
    let duplicatesInDB = 0;
    const tableName = type === "ventas" ? "ventas_reales" : type;
    
    if (type !== "ventas" && codigosInFile.size > 0) {
      // Verificar una muestra de códigos
      const sampleCodes = Array.from(codigosInFile).slice(0, 50);
      
      for (const codigo of sampleCodes) {
        const result = await supabase
          .from(tableName as any)
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("codigo", codigo);
        
        if (result.count && result.count > 0) duplicatesInDB++;
      }
    }

    return {
      hasErrors: !validation.valid || invalidRows > 0,
      hasWarnings: duplicatesInFile > 0 || duplicatesInDB > 0 || validation.extraColumns.length > 0,
      duplicatesInFile,
      duplicatesInDB,
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

      // Ejecutar diagnóstico
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
        toast.error(`Archivo cargado con errores. Revisa el diagnóstico antes de importar.`);
      } else if (diagnostic.hasWarnings) {
        toast.warning(`Archivo cargado con advertencias. Revisa el diagnóstico antes de importar.`);
      } else {
        toast.success(`${jsonData.length.toLocaleString()} registros cargados correctamente`);
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
      toast.error("No se puede importar. El archivo tiene errores críticos. Corrígelos y vuelve a cargar el archivo.");
      return;
    }

    if (diagnostic?.hasWarnings && diagnostic.duplicatesInDB > 0) {
      toast.info("Se detectaron registros existentes. Se actualizarán automáticamente.");
    }

    setUploading(true);
    setUploadProgress(0);
    setCurrentBatch(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuario no autenticado");
        setUploading(false);
        return;
      }

      let dataToInsert: any[] = [];

      switch (type) {
        case "clientes":
          dataToInsert = (data as any[]).map(item => ({
            user_id: user.id,
            codigo: String(item.codigo).trim(),
            nombre: String(item.nombre).trim()
          }));
          break;
        case "marcas":
          dataToInsert = (data as any[]).map(item => ({
            user_id: user.id,
            codigo: String(item.codigo).trim(),
            nombre: String(item.nombre).trim()
          }));
          break;
        case "vendedores":
          dataToInsert = (data as any[]).map(item => ({
            user_id: user.id,
            codigo: String(item.codigo).trim(),
            nombre: String(item.nombre).trim()
          }));
          break;
        case "ventas":
          dataToInsert = (data as any[]).map(item => ({
            user_id: user.id,
            codigo_cliente: String(item.codigo_cliente).trim(),
            codigo_marca: String(item.codigo_marca).trim(),
            codigo_vendedor: item.codigo_vendedor ? String(item.codigo_vendedor).trim() : null,
            mes: String(item.mes).trim(),
            monto: parseFloat(item.monto)
          }));
          break;
      }

      // Procesar en lotes de 1000 registros
      const BATCH_SIZE = 1000;
      const batches = [];
      for (let i = 0; i < dataToInsert.length; i += BATCH_SIZE) {
        batches.push(dataToInsert.slice(i, i + BATCH_SIZE));
      }

      setTotalBatches(batches.length);
      
      let successCount = 0;
      let errorCount = 0;
      const tableName = type === "ventas" ? "ventas_reales" : type;

      for (let i = 0; i < batches.length; i++) {
        setCurrentBatch(i + 1);
        const batch = batches[i];

        // Usar upsert para insertar o actualizar registros existentes
        let result;
        if (type === "ventas") {
          // Para ventas no hay constraint único simple, usar insert directo
          result = await supabase.from(tableName).insert(batch);
        } else {
          // Para clientes, marcas, vendedores: upsert basado en user_id + codigo
          result = await supabase
            .from(tableName)
            .upsert(batch, { 
              onConflict: 'user_id,codigo',
              ignoreDuplicates: false 
            });
        }

        if (result.error) {
          console.error(`Error en lote ${i + 1}:`, result.error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }

        // Actualizar progreso
        const progress = Math.round(((i + 1) / batches.length) * 100);
        setUploadProgress(progress);
      }

      if (errorCount > 0) {
        toast.warning(`${successCount} registros importados, ${errorCount} fallaron`);
      } else {
        toast.success(`¡Importación completada! ${successCount} registros importados exitosamente`);
        const clearedData = { ...importedData };
        delete clearedData[type];
        setImportedData(clearedData);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al importar datos");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentBatch(0);
      setTotalBatches(0);
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
                        <p className="text-destructive"><strong>⚠️ Filas inválidas:</strong> {diagnostics.clientes.invalidRows} (faltan campos requeridos)</p>
                      )}
                      {diagnostics.clientes.duplicatesInFile > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Duplicados en el archivo:</strong> {diagnostics.clientes.duplicatesInFile}</p>
                      )}
                      {diagnostics.clientes.duplicatesInDB > 0 && (
                        <p className="text-blue-600"><strong>ℹ️ Códigos que ya existen en la BD:</strong> {diagnostics.clientes.duplicatesInDB} (se actualizarán)</p>
                      )}
                      {diagnostics.clientes.missingColumns.length > 0 && (
                        <p className="text-destructive"><strong>❌ Columnas faltantes:</strong> {diagnostics.clientes.missingColumns.join(", ")}</p>
                      )}
                      {diagnostics.clientes.extraColumns.length > 0 && (
                        <p className="text-muted-foreground"><strong>ℹ️ Columnas extra (se ignorarán):</strong> {diagnostics.clientes.extraColumns.join(", ")}</p>
                      )}
                      {!diagnostics.clientes.hasErrors && !diagnostics.clientes.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Archivo válido, listo para importar</p>
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
                      <span>Procesando lote {currentBatch} de {totalBatches}</span>
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
                        <p className="text-destructive"><strong>⚠️ Filas inválidas:</strong> {diagnostics.marcas.invalidRows}</p>
                      )}
                      {diagnostics.marcas.duplicatesInFile > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Duplicados en el archivo:</strong> {diagnostics.marcas.duplicatesInFile}</p>
                      )}
                      {diagnostics.marcas.duplicatesInDB > 0 && (
                        <p className="text-blue-600"><strong>ℹ️ Códigos que ya existen en la BD:</strong> {diagnostics.marcas.duplicatesInDB} (se actualizarán)</p>
                      )}
                      {!diagnostics.marcas.hasErrors && !diagnostics.marcas.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Archivo válido</p>
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
                      <span>Procesando lote {currentBatch} de {totalBatches}</span>
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
                        <p className="text-destructive"><strong>⚠️ Filas inválidas:</strong> {diagnostics.vendedores.invalidRows}</p>
                      )}
                      {diagnostics.vendedores.duplicatesInFile > 0 && (
                        <p className="text-yellow-600"><strong>⚠️ Duplicados en el archivo:</strong> {diagnostics.vendedores.duplicatesInFile}</p>
                      )}
                      {diagnostics.vendedores.duplicatesInDB > 0 && (
                        <p className="text-blue-600"><strong>ℹ️ Códigos que ya existen en la BD:</strong> {diagnostics.vendedores.duplicatesInDB} (se actualizarán)</p>
                      )}
                      {!diagnostics.vendedores.hasErrors && !diagnostics.vendedores.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Archivo válido</p>
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
                      <span>Procesando lote {currentBatch} de {totalBatches}</span>
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
                        <p className="text-destructive"><strong>⚠️ Filas inválidas:</strong> {diagnostics.ventas.invalidRows}</p>
                      )}
                      {diagnostics.ventas.duplicatesInDB > 0 && (
                        <p className="text-blue-600"><strong>ℹ️ Registros existentes en BD:</strong> {diagnostics.ventas.duplicatesInDB} (se agregarán como nuevos)</p>
                      )}
                      {!diagnostics.ventas.hasErrors && !diagnostics.ventas.hasWarnings && (
                        <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Archivo válido</p>
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
                      <span>Procesando lote {currentBatch} de {totalBatches}</span>
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
