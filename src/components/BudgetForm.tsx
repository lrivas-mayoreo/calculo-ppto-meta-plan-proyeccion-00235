import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, Upload, X, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { MarcaPresupuesto } from "@/pages/Index";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BudgetFormProps {
  onCalculate: (
    marcasPresupuesto: MarcaPresupuesto[],
    mesesReferencia: string[]
  ) => void;
  mockData: {
    marcas: string[];
    empresas: string[];
    articulos: Record<string, string[]>;
  };
  mesesDisponibles: string[];
  onMarcasPresupuestoLoad: (marcas: MarcaPresupuesto[]) => void;
}

export const BudgetForm = ({ onCalculate, mockData, mesesDisponibles, onMarcasPresupuestoLoad }: BudgetFormProps) => {
  const [mesesReferencia, setMesesReferencia] = useState<string[]>([]);
  const [marcasPresupuesto, setMarcasPresupuesto] = useState<MarcaPresupuesto[]>([]);
  const [marcasConError, setMarcasConError] = useState<Array<{ marca: string; error: string }>>([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [showMarcasCargadas, setShowMarcasCargadas] = useState(false);
  const [showMarcasError, setShowMarcasError] = useState(false);

  const handleMesToggle = (mesAnio: string) => {
    setMesesReferencia((prev) =>
      prev.includes(mesAnio) ? prev.filter((m) => m !== mesAnio) : [...prev, mesAnio]
    );
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    toast.info("Procesando archivo Excel...");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Validar estructura del Excel
        if (jsonData.length === 0) {
          toast.error("El archivo Excel está vacío");
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        // Validar que tenga las columnas necesarias (Marca, Mes y Presupuesto)
        const firstRow = jsonData[0];
        if (!firstRow.Marca && !firstRow.marca) {
          toast.error("El archivo Excel debe tener una columna 'Marca'");
          setExcelFileName("");
          e.target.value = "";
          return;
        }
        if (!firstRow.Fecha && !firstRow.fecha) {
          toast.error("El archivo Excel debe tener una columna 'Fecha' (formato: YYYY/MM/DD)");
          setExcelFileName("");
          e.target.value = "";
          return;
        }
        if (!firstRow.Empresa && !firstRow.empresa) {
          toast.error("El archivo Excel debe tener una columna 'Empresa'");
          setExcelFileName("");
          e.target.value = "";
          return;
        }
        if (!firstRow.Presupuesto && !firstRow.presupuesto) {
          toast.error("El archivo Excel debe tener una columna 'Presupuesto'");
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        // Parsear datos y validar formato de fecha
        const marcasFromExcel: MarcaPresupuesto[] = [];
        const errores: Array<{ marca: string; error: string }> = [];
        
        jsonData.forEach((row) => {
          const marca = row.Marca || row.marca;
          const fechaDestino = row.Fecha || row.fecha;
          const empresa = row.Empresa || row.empresa;
          const presupuesto = parseFloat(row.Presupuesto || row.presupuesto);
          
          // Validar que todos los campos estén presentes
          if (!marca || !fechaDestino || !empresa || isNaN(presupuesto)) {
            if (marca) {
              errores.push({ marca, error: "Datos incompletos" });
            }
            return;
          }
          
          // Validar formato de fecha YYYY/MM/DD
          const fechaRegex = /^\d{4}\/\d{2}\/\d{2}$/;
          if (!fechaRegex.test(fechaDestino)) {
            errores.push({ marca, error: "Formato de fecha inválido (use YYYY/MM/DD)" });
            return;
          }
          
          marcasFromExcel.push({
            marca,
            fechaDestino,
            empresa,
            presupuesto,
          });
        });

        // Validar que las marcas existan en el maestro
        marcasFromExcel.forEach((item) => {
          if (!mockData.marcas.includes(item.marca)) {
            errores.push({ marca: item.marca, error: "Marca no existe en el maestro" });
          }
          if (!mockData.empresas.includes(item.empresa)) {
            errores.push({ marca: item.marca, error: `Empresa "${item.empresa}" no existe` });
          }
        });

        // Guardar marcas con errores
        setMarcasConError(errores);

        if (marcasFromExcel.length === 0 && errores.length > 0) {
          toast.error("No se encontraron datos válidos en el archivo");
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        setMarcasPresupuesto(marcasFromExcel);
        onMarcasPresupuestoLoad(marcasFromExcel);
        
        if (errores.length > 0) {
          toast.warning(
            `Archivo cargado con ${marcasFromExcel.length} marca(s) válida(s) y ${errores.length} error(es)`
          );
        } else {
          toast.success(
            `Archivo cargado correctamente: ${marcasFromExcel.length} marca(s) con presupuesto`
          );
        }
      } catch (error) {
        toast.error("Error al procesar el archivo Excel");
        setExcelFileName("");
        e.target.value = "";
        console.error(error);
      }
    };

    reader.onerror = () => {
      toast.error("Error al leer el archivo");
      setExcelFileName("");
      e.target.value = "";
    };

    reader.readAsBinaryString(file);
  };

  const handleRemoveExcel = () => {
    setMarcasPresupuesto([]);
    setMarcasConError([]);
    setExcelFileName("");
    onMarcasPresupuestoLoad([]);
    const fileInput = document.getElementById("excel-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    setShowMarcasCargadas(false);
    setShowMarcasError(false);
    toast.info("Archivo Excel removido");
  };

  const handleDownloadTemplate = () => {
    // Crear array con las marcas disponibles y columnas de Fecha, Empresa y Presupuesto con ejemplos
    const templateData = mockData.marcas.map((marca, index) => ({
      Marca: marca,
      Fecha: index === 0 ? "2025/12/31" : "",
      Empresa: index === 0 ? mockData.empresas[0] : "",
      Presupuesto: index === 0 ? "100000" : "",
    }));

    // Crear libro de Excel
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Marcas");

    // Descargar archivo
    XLSX.writeFile(workbook, "Template_Marcas_Presupuesto.xlsx");
    toast.success("Template Excel descargado correctamente");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mesesReferencia.length === 0) {
      toast.error("Seleccione al menos un mes de referencia");
      return;
    }

    if (marcasPresupuesto.length === 0) {
      toast.error("Por favor cargue un archivo Excel con marcas, fechas, empresas y presupuestos");
      return;
    }

    try {
      onCalculate(marcasPresupuesto, mesesReferencia);
      toast.success(
        `Cálculo realizado exitosamente para ${marcasPresupuesto.length} marca(s)`
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Parámetros de Cálculo</h2>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="excel-upload">Cargar Excel con Marcas y Presupuestos *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar Template
          </Button>
        </div>
        {excelFileName ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
              <div className="flex-1 truncate text-sm">
                <span className="font-medium">{excelFileName}</span>
                <span className="ml-2 text-muted-foreground">
                  ({marcasPresupuesto.length} marca{marcasPresupuesto.length !== 1 ? "s" : ""})
                </span>
                {marcasConError.length > 0 && (
                  <span className="ml-2 text-destructive">
                    ({marcasConError.length} error{marcasConError.length !== 1 ? "es" : ""})
                  </span>
                )}
              </div>
              {marcasConError.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMarcasError(!showMarcasError)}
                  className="h-8 w-8"
                >
                  <Eye className="h-4 w-4 text-destructive" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowMarcasCargadas(!showMarcasCargadas)}
                className="h-8 w-8"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRemoveExcel}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {marcasConError.length > 0 && (
              <Collapsible open={showMarcasError} onOpenChange={setShowMarcasError}>
                <CollapsibleContent>
                  <div className="rounded-md border border-destructive bg-destructive/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marcasConError.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.marca}</TableCell>
                            <TableCell className="text-destructive">{item.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            <Collapsible open={showMarcasCargadas} onOpenChange={setShowMarcasCargadas}>
              <CollapsibleContent>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-right">Presupuesto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marcasPresupuesto.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.marca}</TableCell>
                          <TableCell>{item.fechaDestino}</TableCell>
                          <TableCell>{item.empresa}</TableCell>
                          <TableCell className="text-right">
                            ${item.presupuesto.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="cursor-pointer"
            />
            <Button type="button" variant="outline" size="icon">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Formato: Columnas "Marca", "Fecha" (YYYY/MM/DD), "Empresa" y "Presupuesto"
        </p>
      </div>

      <div className="space-y-3">
        <Label>Meses de Referencia (Mes-Año) *</Label>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            {mesesDisponibles.map((mesAnio) => (
              <div key={mesAnio} className="flex items-center space-x-2">
                <Checkbox
                  id={`mes-${mesAnio}`}
                  checked={mesesReferencia.includes(mesAnio)}
                  onCheckedChange={() => handleMesToggle(mesAnio)}
                />
                <label
                  htmlFor={`mes-${mesAnio}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {mesAnio}
                </label>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Seleccionados: {mesesReferencia.length} mes(es)
        </p>
      </div>

      <Button type="submit" className="w-full">
        <Calculator className="mr-2 h-4 w-4" />
        Calcular Presupuesto
      </Button>
    </form>
  );
};
