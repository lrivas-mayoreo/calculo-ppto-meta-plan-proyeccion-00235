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
import { Calculator, Upload } from "lucide-react";
import { toast } from "sonner";
import type { MarcaPresupuesto } from "@/pages/Index";

interface BudgetFormProps {
  onCalculate: (
    marca: string,
    mesDestino: string,
    presupuesto: number,
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
  const [marca, setMarca] = useState("");
  const [mesDestino, setMesDestino] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [mesesReferencia, setMesesReferencia] = useState<string[]>([]);

  const handleMesToggle = (mesAnio: string) => {
    setMesesReferencia((prev) =>
      prev.includes(mesAnio) ? prev.filter((m) => m !== mesAnio) : [...prev, mesAnio]
    );
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulación de carga de Excel
    // En producción, usarías una librería como xlsx para parsear el archivo
    toast.info("Procesando archivo Excel...");
    
    setTimeout(() => {
      // Datos simulados del Excel
      const marcasFromExcel: MarcaPresupuesto[] = [
        { marca: "Nike", presupuesto: 50000 },
        { marca: "Adidas", presupuesto: 45000 },
      ];

      onMarcasPresupuestoLoad(marcasFromExcel);
      toast.success("Archivo Excel cargado correctamente");
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!marca || !mesDestino || !presupuesto) {
      toast.error("Por favor complete todos los campos obligatorios");
      return;
    }

    if (mesesReferencia.length === 0) {
      toast.error("Seleccione al menos un mes de referencia");
      return;
    }

    const presupuestoNum = parseFloat(presupuesto);
    if (isNaN(presupuestoNum) || presupuestoNum <= 0) {
      toast.error("Ingrese un presupuesto válido");
      return;
    }

    try {
      onCalculate(marca, mesDestino, presupuestoNum, mesesReferencia);
      
      // Calcular y mostrar promedio de ventas de meses seleccionados
      const ventasPorMes = mesesReferencia.map(mesAnio => {
        let totalMes = 0;
        mockData.marcas.forEach(m => {
          if (m === marca) {
            // Simular suma de ventas (en producción vendría de los datos reales)
            totalMes += Math.floor(Math.random() * 50000) + 30000;
          }
        });
        return totalMes;
      });
      
      const promedioVentas = ventasPorMes.reduce((a, b) => a + b, 0) / ventasPorMes.length;
      
      toast.success(
        `Cálculo realizado exitosamente. Promedio de ventas de ${mesesReferencia.length} meses: $${promedioVentas.toLocaleString("es-ES", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
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
        <Label htmlFor="excel-upload">Cargar Excel (Opcional)</Label>
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
        <p className="text-xs text-muted-foreground">
          Formato: Columnas "Marca" y "Presupuesto"
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="marca">Marca *</Label>
        <Select value={marca} onValueChange={setMarca}>
          <SelectTrigger id="marca">
            <SelectValue placeholder="Seleccione una marca" />
          </SelectTrigger>
          <SelectContent>
            {mockData.marcas.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="space-y-2">
        <Label htmlFor="presupuesto">Presupuesto a Distribuir *</Label>
        <Input
          id="presupuesto"
          type="number"
          placeholder="20000"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
          min="0"
          step="0.01"
        />
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
