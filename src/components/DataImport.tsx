import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportedData {
  clientes?: Array<{ codigo: string; nombre: string }>;
  marcas?: Array<{ codigo: string; nombre: string }>;
  vendedores?: Array<{ codigo: string; nombre: string }>;
  ventas?: Array<{ codigo_cliente: string; codigo_marca: string; codigo_vendedor: string; mes: string; monto: number }>;
}

export const DataImport = () => {
  const [uploading, setUploading] = useState(false);
  const [importedData, setImportedData] = useState<ImportedData>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

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

  const validateExcel = (data: any[], type: string): boolean => {
    if (!data || data.length === 0) {
      toast.error("El archivo Excel está vacío");
      return false;
    }

    const requiredFields: Record<string, string[]> = {
      clientes: ["codigo", "nombre"],
      marcas: ["codigo", "nombre"],
      vendedores: ["codigo", "nombre"],
      ventas: ["codigo_cliente", "codigo_marca", "codigo_vendedor", "mes", "monto"]
    };

    const fields = requiredFields[type];
    const firstRow = data[0];
    
    for (const field of fields) {
      if (!(field in firstRow)) {
        toast.error(`Falta la columna requerida: ${field}`);
        return false;
      }
    }

    return true;
  };

  const handleExcelUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "clientes" | "marcas" | "vendedores" | "ventas"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!validateExcel(jsonData, type)) {
        event.target.value = "";
        return;
      }

      const typedData = {
        ...importedData,
        [type]: jsonData
      } as ImportedData;
      setImportedData(typedData);
      toast.success(`${jsonData.length} registros cargados del Excel`);
    } catch (error) {
      console.error("Error reading Excel:", error);
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

        const result = await supabase.from(tableName).insert(batch);

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
                  disabled={uploading}
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
                  disabled={uploading}
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
                  disabled={uploading}
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
                  disabled={uploading}
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
