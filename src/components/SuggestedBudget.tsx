import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Checkbox } from "@/components/ui/checkbox"; // ya no se usa
import { Sparkles, Download, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SuggestedBudgetProps {
  historicalData: Array<{
    marca: string;
    empresa: string;
    presupuesto: number;
    fechaDestino: string;
  }>;
  marcasDisponibles: string[];
  empresasDisponibles: string[];
  mesesDisponibles: string[];
  ventasData: Array<{
    mesAnio: string;
    marca: string;
    cliente: string;
    articulo: string;
    vendedor: string;
    empresa: string;
    venta: number;
  }>;
  onApplySuggestion: (
    marcas: Array<{ marca: string; fechaDestino: string; empresa: string; presupuesto: number }>,
    mesesReferencia: string[]
  ) => void;
}

export const SuggestedBudget = ({
  historicalData,
  marcasDisponibles,
  empresasDisponibles,
  mesesDisponibles,
  ventasData,
  onApplySuggestion,
}: SuggestedBudgetProps) => {
  const [totalBudget, setTotalBudget] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [selectedMeses, setSelectedMeses] = useState<string[]>([]);
  const [suggestedDistribution, setSuggestedDistribution] = useState<
    Array<{ marca: string; empresa: string; porcentaje: number; monto: number; promedioVenta: number }>
  >([]);
  const [isOpen, setIsOpen] = useState(false);

  // Convierte "YYYY/MM/DD" o "YYYY-MM-DD" a "mes-AAAA" (es-ES)
  const convertDateToMesAnio = (dateStr: string): string => {
    const cleanDate = dateStr.replace(/\//g, "-");
    const [year, month, day] = cleanDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const mes = date.toLocaleString("es-ES", { month: "long" });
    const anio = date.getFullYear();
    return `${mes}-${anio}`;
  };

  // Filtra históricos por meses seleccionados
  const filteredHistoricalData = useMemo(() => {
    if (selectedMeses.length === 0) return [];

    const filtered = historicalData.filter((item) => {
      const itemMesAnio = convertDateToMesAnio(item.fechaDestino);
      return selectedMeses.includes(itemMesAnio) && item.presupuesto > 0;
    });

    return filtered;
  }, [historicalData, selectedMeses]);

  const handleMesToggle = (mes: string) => {
    setSelectedMeses((prev) => (prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes]));
    setSuggestedDistribution([]); // reset distribución al cambiar meses
  };

  const calculateSuggestion = () => {
    if (selectedMeses.length === 0) {
      toast.error("Seleccione al menos un mes de referencia");
      return;
    }
    if (!totalBudget || parseFloat(totalBudget) <= 0) {
      toast.error("Ingrese un monto de presupuesto válido");
      return;
    }
    if (!targetDate) {
      toast.error("Seleccione una fecha destino");
      return;
    }

    const budget = parseFloat(totalBudget);

    console.log('Calculating suggestion...');
    console.log('Selected meses:', selectedMeses);
    console.log('Ventas data sample:', ventasData.slice(0, 3));
    console.log('Total ventas data:', ventasData.length);

    // Promedio = Σ(Ventas en Meses de Referencia) / Cantidad de Meses de Referencia
    const brandEmpresaData = new Map<string, { empresa: string; totalVentas: number; totalPresupuesto: number }>();

    // Ventas de los meses seleccionados
    const ventasMesesSeleccionados = ventasData.filter((v) => selectedMeses.includes(v.mesAnio));
    
    console.log('Ventas meses seleccionados:', ventasMesesSeleccionados.length);
    console.log('Sample filtered ventas:', ventasMesesSeleccionados.slice(0, 3));
    
    ventasMesesSeleccionados.forEach((venta) => {
      const key = `${venta.marca}|${venta.empresa}`;
      const current = brandEmpresaData.get(key);
      if (current) {
        current.totalVentas += venta.venta;
      } else {
        brandEmpresaData.set(key, { empresa: venta.empresa, totalVentas: venta.venta, totalPresupuesto: 0 });
      }
    });

    // Presupuestos históricos de los meses seleccionados
    filteredHistoricalData.forEach((item) => {
      const key = `${item.marca}|${item.empresa}`;
      const current = brandEmpresaData.get(key);
      if (current) {
        current.totalPresupuesto += item.presupuesto;
      } else {
        brandEmpresaData.set(key, { empresa: item.empresa, totalVentas: 0, totalPresupuesto: item.presupuesto });
      }
    });

    console.log('Brand empresa data:', Array.from(brandEmpresaData.entries()));

    // Marcas válidas: primero intentar con ventas y presupuesto, luego solo con ventas
    let validBrands = Array.from(brandEmpresaData.entries())
      .filter(([, data]) => data.totalPresupuesto > 0 && data.totalVentas > 0)
      .map(([key, data]) => {
        const [marca] = key.split("|");
        const promedioVenta = data.totalVentas / selectedMeses.length;
        return { marca, empresa: data.empresa, total: data.totalPresupuesto, promedioVenta };
      });

    // Si no hay marcas con presupuesto histórico, usar solo ventas para calcular distribución
    if (validBrands.length === 0) {
      validBrands = Array.from(brandEmpresaData.entries())
        .filter(([, data]) => data.totalVentas > 0)
        .map(([key, data]) => {
          const [marca] = key.split("|");
          const promedioVenta = data.totalVentas / selectedMeses.length;
          return { marca, empresa: data.empresa, total: promedioVenta, promedioVenta };
        });
      
      if (validBrands.length === 0) {
        toast.error("No hay marcas con ventas en los meses seleccionados");
        return;
      }
      
      toast.info("Calculando distribución basada en ventas históricas (sin presupuestos previos)");
    }

    const totalHistorical = validBrands.reduce((sum, item) => sum + item.total, 0);

    const distribution = validBrands
      .map((item) => {
        const porcentaje = (item.total / totalHistorical) * 100;
        const monto = (budget * porcentaje) / 100;
        return { marca: item.marca, empresa: item.empresa, porcentaje, monto, promedioVenta: item.promedioVenta };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    setSuggestedDistribution(distribution);

    const promedioTotal = validBrands.reduce((sum, item) => sum + item.promedioVenta, 0);
    const promedioGeneral = promedioTotal / validBrands.length;

    toast.success(`Presupuesto distribuido entre ${distribution.length} marcas`);
    toast.info(
      `Promedio de ventas en meses seleccionados: $${promedioGeneral.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  };

  const handleApply = () => {
    if (suggestedDistribution.length === 0) {
      toast.error("Primero calcule la distribución sugerida");
      return;
    }

    const marcasPresupuesto = suggestedDistribution.map((item) => ({
      marca: item.marca,
      fechaDestino: targetDate,
      empresa: item.empresa,
      presupuesto: item.monto,
    }));

    onApplySuggestion(marcasPresupuesto, selectedMeses);
    toast.success("Presupuesto sugerido aplicado y distribución calculada");
    setIsOpen(false);
    resetForm();
  };

  const handleDownload = () => {
    if (suggestedDistribution.length === 0) {
      toast.error("Primero calcule la distribución sugerida");
      return;
    }

    const excelData = suggestedDistribution.map((item) => ({
      Marca: item.marca,
      Empresa: item.empresa,
      Fecha: targetDate,
      Presupuesto: item.monto,
      Porcentaje: `${item.porcentaje.toFixed(2)}%`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Presupuesto Sugerido");

    XLSX.writeFile(workbook, `Presupuesto_Sugerido_${targetDate}.xlsx`);
    toast.success("Archivo descargado exitosamente");
  };

  const resetForm = () => {
    setTotalBudget("");
    setTargetDate("");
    setSelectedMeses([]);
    setSuggestedDistribution([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Presupuesto Sugerido
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Presupuesto Sugerido por Marca
          </DialogTitle>
          <DialogDescription>
            Seleccione los meses de referencia y la distribución se calculará automáticamente basándose en el
            comportamiento histórico
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selección de meses (tiles) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Meses de Referencia *</Label>
              {selectedMeses.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedMeses([])}>
                  Limpiar
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
              {mesesDisponibles.map((mes) => {
                const selected = selectedMeses.includes(mes);
                return (
                  <button
                    key={mes}
                    type="button"
                    onClick={() => handleMesToggle(mes)}
                    aria-pressed={selected}
                    className={[
                      "relative w-full rounded-xl border px-3 py-2 text-sm font-medium text-left transition",
                      "focus:outline-none focus:ring-2 focus:ring-offset-2",
                      selected ? "border-blue-600 bg-blue-50 ring-blue-600" : "border-gray-300 hover:border-gray-400",
                    ].join(" ")}
                  >
                    <span className="block truncate pr-6">{mes}</span>
                    {selected && <Check className="absolute top-2 right-2 h-4 w-4" />}
                  </button>
                );
              })}
            </div>

            {selectedMeses.length > 0 && (
              <p className="text-sm text-gray-500">
                {selectedMeses.length} {selectedMeses.length === 1 ? "mes seleccionado" : "meses seleccionados"}
              </p>
            )}
            {/* para mejorar el formato de los botones */}
          </div>

          {/* Inputs solo si hay meses y datos */}
          {selectedMeses.length > 0 && filteredHistoricalData.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total-budget">Presupuesto Total *</Label>
                  <Input
                    id="total-budget"
                    type="number"
                    step="0.01"
                    placeholder="Ej: 1000000"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-date">Fecha Destino *</Label>
                  <Input
                    id="target-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={calculateSuggestion} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                Calcular Distribución
              </Button>
            </>
          )}

          {selectedMeses.length > 0 && filteredHistoricalData.length === 0 && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              No hay datos históricos con presupuesto en los meses seleccionados
            </p>
          )}

          {suggestedDistribution.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Participación</TableHead>
                      <TableHead className="text-right">Monto Sugerido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestedDistribution.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.marca}
                          <div className="text-xs text-muted-foreground">
                            Promedio: $
                            {item.promedioVenta.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>{item.empresa}</TableCell>
                        <TableCell className="text-right">{item.porcentaje.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">
                          $
                          {item.monto.toLocaleString("es-ES", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">100.00%</TableCell>
                      <TableCell className="text-right">
                        $
                        {parseFloat(totalBudget).toLocaleString("es-ES", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleApply} className="flex-1">
                  Aplicar Presupuesto
                </Button>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
