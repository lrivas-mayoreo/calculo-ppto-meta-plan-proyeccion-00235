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
import { Calculator, Upload, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { MarcaPresupuesto } from "@/pages/Index";

interface BudgetFormProps {
  onCalculate: (
    mesDestino: string,
    marcasPresupuesto: MarcaPresupuesto[],
    mesesReferencia: string[]
  ) => void;
  mockData: {
    marcas: string[];
    articulos: Record<string, string[]>;
  };
  mesesDisponibles: string[];
  onMarcasPresupuestoLoad: (marcas: MarcaPresupuesto[]) => void;
}

export const BudgetForm = ({ onCalculate, mockData, mesesDisponibles, onMarcasPresupuestoLoad }: BudgetFormProps) => {
  const [mesDestino, setMesDestino] = useState("");
  const [mesesReferencia, setMesesReferencia] = useState<string[]>([]);
  const [marcasPresupuesto, setMarcasPresupuesto] = useState<MarcaPresupuesto[]>([]);
  const [excelFileName, setExcelFileName] = useState("");

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

        // Validar que tenga las columnas necesarias (Marca y Presupuesto)
        const firstRow = jsonData[0];
        if (!firstRow.Marca && !firstRow.marca) {
          toast.error("El archivo Excel debe tener una columna 'Marca'");
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

        // Parsear datos
        const marcasFromExcel: MarcaPresupuesto[] = jsonData.map((row) => ({
          marca: row.Marca || row.marca,
          presupuesto: parseFloat(row.Presupuesto || row.presupuesto),
        })).filter(item => item.marca && !isNaN(item.presupuesto));

        if (marcasFromExcel.length === 0) {
          toast.error("No se encontraron datos válidos en el archivo");
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        // Validar que las marcas existan en el maestro
        const marcasInvalidas = marcasFromExcel.filter(
          (item) => !mockData.marcas.includes(item.marca)
        );

        if (marcasInvalidas.length > 0) {
          toast.error(
            `Error 1: Las siguientes marcas no existen en el maestro: ${marcasInvalidas
              .map((m) => m.marca)
              .join(", ")}`
          );
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        setMarcasPresupuesto(marcasFromExcel);
        onMarcasPresupuestoLoad(marcasFromExcel);
        toast.success(
          `Archivo cargado correctamente: ${marcasFromExcel.length} marca(s) con presupuesto`
        );
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
    setExcelFileName("");
    onMarcasPresupuestoLoad([]);
    const fileInput = document.getElementById("excel-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    toast.info("Archivo Excel removido");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!mesDestino) {
      toast.error("Por favor seleccione el mes destino");
      return;
    }

    if (mesesReferencia.length === 0) {
      toast.error("Seleccione al menos un mes de referencia");
      return;
    }

    if (marcasPresupuesto.length === 0) {
      toast.error("Por favor cargue un archivo Excel con marcas y presupuestos");
      return;
    }

    try {
      onCalculate(mesDestino, marcasPresupuesto, mesesReferencia);
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
        <Label htmlFor="excel-upload">Cargar Excel con Marcas y Presupuestos *</Label>
        {excelFileName ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
            <div className="flex-1 truncate text-sm">
              <span className="font-medium">{excelFileName}</span>
              <span className="ml-2 text-muted-foreground">
                ({marcasPresupuesto.length} marca{marcasPresupuesto.length !== 1 ? "s" : ""})
              </span>
            </div>
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
          Formato: Columnas "Marca" y "Presupuesto"
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mesDestino">Mes Destino (Mes-Año) *</Label>
        <Select value={mesDestino} onValueChange={setMesDestino}>
          <SelectTrigger id="mesDestino">
            <SelectValue placeholder="Seleccione el mes destino" />
          </SelectTrigger>
          <SelectContent>
            {mesesDisponibles.map((mesAnio) => (
              <SelectItem key={mesAnio} value={mesAnio}>
                {mesAnio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
