import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, FileText, AlertTriangle, CheckCircle, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CSVRow {
  [key: string]: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  previewData: CSVRow[];
}

export const CSVImport = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [parsedData, setParsedData] = useState<{ type: string; data: CSVRow[] } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const detectType = (headers: string[]): string | null => {
    const headerSet = new Set(headers.map(h => h.toLowerCase()));
    
    if (headerSet.has('codigo') && headerSet.has('nombre') && headers.length === 2) {
      return 'clientes'; // o marcas o vendedores
    }
    
    if (headerSet.has('codigo_cliente') && headerSet.has('codigo_marca') && 
        headerSet.has('mes') && headerSet.has('monto')) {
      return 'ventas';
    }
    
    return null;
  };

  const validateData = (data: CSVRow[], type: string): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const previewData = data.slice(0, 5);

    if (data.length === 0) {
      errors.push("El archivo está vacío");
      return { valid: false, errors, warnings, rowCount: 0, previewData: [] };
    }

    // Validaciones específicas por tipo
    if (type === 'clientes' || type === 'marcas' || type === 'vendedores') {
      const codigosSet = new Set();
      data.forEach((row, idx) => {
        if (!row.codigo || !row.nombre) {
          errors.push(`Fila ${idx + 2}: Faltan campos requeridos`);
        }
        if (codigosSet.has(row.codigo)) {
          warnings.push(`Código duplicado: ${row.codigo}`);
        }
        codigosSet.add(row.codigo);
      });
    }

    if (type === 'ventas') {
      data.forEach((row, idx) => {
        if (!row.codigo_cliente || !row.codigo_marca || !row.mes || !row.monto) {
          errors.push(`Fila ${idx + 2}: Faltan campos requeridos`);
        }
        if (row.monto && isNaN(parseFloat(row.monto))) {
          errors.push(`Fila ${idx + 2}: Monto inválido`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rowCount: data.length,
      previewData
    };
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error("Solo se permiten archivos CSV");
      return;
    }

    const text = await file.text();
    const rows = parseCSV(text);
    
    if (rows.length === 0) {
      toast.error("El archivo no contiene datos válidos");
      return;
    }

    const headers = Object.keys(rows[0]);
    const type = detectType(headers);

    if (!type) {
      toast.error("Formato de CSV no reconocido. Verifica las columnas.");
      return;
    }

    const validation = validateData(rows, type);
    setValidationResult(validation);
    setParsedData({ type, data: rows });

    if (validation.valid) {
      toast.success(`Archivo validado: ${validation.rowCount} filas`);
    } else {
      toast.warning("Se encontraron errores en el archivo");
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const importToDatabase = async () => {
    if (!parsedData || !validationResult?.valid) {
      toast.error("No hay datos válidos para importar");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const batchSize = 3000;
      const { type, data } = parsedData;
      
      // Crear job de importación
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          type,
          total_rows: data.length,
          status: 'pending'
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Normalizar datos
      const normalizedData = data.map(row => {
        if (type === 'clientes' || type === 'marcas' || type === 'vendedores') {
          return {
            codigo: row.codigo,
            nombre: row.nombre
          };
        } else if (type === 'ventas') {
          return {
            codigo_cliente: row.codigo_cliente,
            codigo_marca: row.codigo_marca,
            codigo_vendedor: row.codigo_vendedor || null,
            mes: row.mes,
            monto: parseFloat(row.monto)
          };
        }
        return row;
      });

      // Enviar en lotes
      for (let i = 0; i < normalizedData.length; i += batchSize) {
        const batch = normalizedData.slice(i, i + batchSize);
        const isFirstBatch = i === 0;
        const isLastBatch = i + batchSize >= normalizedData.length;

        const { error } = await supabase.functions.invoke('import-data-batch', {
          body: {
            jobId: job.id,
            batch,
            isFirstBatch,
            isLastBatch,
            type
          }
        });

        if (error) throw error;

        const progressPercent = Math.min(90, ((i + batch.length) / normalizedData.length) * 90);
        setProgress(progressPercent);
      }

      // Monitorear progreso
      const checkInterval = setInterval(async () => {
        const { data: jobStatus } = await supabase
          .from('import_jobs')
          .select('status, processed_rows, error_count')
          .eq('id', job.id)
          .single();

        if (jobStatus) {
          if (jobStatus.status === 'completed') {
            clearInterval(checkInterval);
            setProgress(100);
            toast.success(`Importación completada: ${jobStatus.processed_rows} registros`);
            setParsedData(null);
            setValidationResult(null);
            setUploading(false);
          } else if (jobStatus.status === 'failed') {
            clearInterval(checkInterval);
            toast.error("Error en la importación");
            setUploading(false);
          }
        }
      }, 2000);

    } catch (error: any) {
      console.error("Error en importación:", error);
      toast.error(`Error: ${error.message}`);
      setUploading(false);
    }
  };

  const downloadTemplate = (type: string) => {
    let csvContent = "";
    
    if (type === 'clientes' || type === 'marcas' || type === 'vendedores') {
      csvContent = "codigo,nombre\n";
      csvContent += "001,Ejemplo 1\n";
      csvContent += "002,Ejemplo 2\n";
    } else if (type === 'ventas') {
      csvContent = "codigo_cliente,codigo_marca,codigo_vendedor,mes,monto\n";
      csvContent += "001,M01,V01,2025-01,5000\n";
      csvContent += "002,M02,V02,2025-01,7500\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${type}.csv`;
    a.click();
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Importación de Datos CSV</h3>
            <p className="text-sm text-muted-foreground">Sistema optimizado para grandes volúmenes</p>
          </div>
        </div>

        <Tabs defaultValue="upload">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Cargar Archivo</TabsTrigger>
            <TabsTrigger value="templates">Descargar Plantillas</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Arrastra tu archivo CSV aquí</p>
              <p className="text-xs text-muted-foreground mt-2">o haz clic para seleccionar</p>
            </div>

            {validationResult && (
              <Alert variant={validationResult.valid ? "default" : "destructive"}>
                {validationResult.valid ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {validationResult.valid ? "Validación exitosa" : "Errores encontrados"}
                </AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    <p>Total de filas: {validationResult.rowCount}</p>
                    {validationResult.errors.map((err, idx) => (
                      <p key={idx} className="text-sm text-destructive">{err}</p>
                    ))}
                    {validationResult.warnings.map((warn, idx) => (
                      <p key={idx} className="text-sm text-yellow-600">{warn}</p>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validationResult?.previewData && validationResult.previewData.length > 0 && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">Vista previa (primeras 5 filas)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {Object.keys(validationResult.previewData[0]).map(key => (
                          <th key={key} className="text-left p-2 font-medium">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.previewData.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          {Object.values(row).map((val, i) => (
                            <td key={i} className="p-2">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">{Math.round(progress)}%</p>
              </div>
            )}

            {parsedData && validationResult?.valid && !uploading && (
              <Button onClick={importToDatabase} className="w-full" size="lg">
                <Upload className="mr-2 h-4 w-4" />
                Importar {validationResult.rowCount} registros
              </Button>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => downloadTemplate('clientes')}>
                <Download className="mr-2 h-4 w-4" />
                Plantilla Clientes
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate('marcas')}>
                <Download className="mr-2 h-4 w-4" />
                Plantilla Marcas
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate('vendedores')}>
                <Download className="mr-2 h-4 w-4" />
                Plantilla Vendedores
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate('ventas')}>
                <Download className="mr-2 h-4 w-4" />
                Plantilla Ventas
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};
