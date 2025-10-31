import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Sparkles, Download } from "lucide-react";
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
  onApplySuggestion: (marcas: Array<{ marca: string; fechaDestino: string; empresa: string; presupuesto: number }>) => void;
}

export const SuggestedBudget = ({ 
  historicalData, 
  marcasDisponibles, 
  empresasDisponibles, 
  mesesDisponibles,
  ventasData,
  onApplySuggestion 
}: SuggestedBudgetProps) => {
  const [totalBudget, setTotalBudget] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [selectedMeses, setSelectedMeses] = useState<string[]>([]);
  const [suggestedDistribution, setSuggestedDistribution] = useState<Array<{ marca: string; empresa: string; porcentaje: number; monto: number; promedioVenta: number }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Convert date format to month-year format (e.g., "diciembre-2024")
  const convertDateToMesAnio = (dateStr: string): string => {
    // Handle both YYYY/MM/DD and YYYY-MM-DD formats
    const cleanDate = dateStr.replace(/\//g, '-');
    const [year, month, day] = cleanDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const mes = date.toLocaleString("es-ES", { month: "long" });
    const anio = date.getFullYear();
    return `${mes}-${anio}`;
  };

  // Filter historical data by selected months
  const filteredHistoricalData = useMemo(() => {
    console.log("=== DEBUG FILTRADO ===");
    console.log("Meses seleccionados:", selectedMeses);
    console.log("Total datos históricos:", historicalData.length);
    console.log("Datos históricos completos:", historicalData);
    
    if (selectedMeses.length === 0) return [];
    
    // Log sample of dates to see format
    if (historicalData.length > 0) {
      console.log("Muestra de fechas originales:", historicalData.slice(0, 3).map(d => d.fechaDestino));
      console.log("Muestra de fechas convertidas:", historicalData.slice(0, 3).map(d => convertDateToMesAnio(d.fechaDestino)));
    }
    
    const filtered = historicalData.filter(item => {
      const itemMesAnio = convertDateToMesAnio(item.fechaDestino);
      const matches = selectedMeses.includes(itemMesAnio) && item.presupuesto > 0;
      return matches;
    });
    
    console.log("Datos después del filtro:", filtered.length);
    console.log("Empresas en datos filtrados:", [...new Set(filtered.map(d => d.empresa))]);
    
    return filtered;
  }, [historicalData, selectedMeses]);


  const handleMesToggle = (mes: string) => {
    setSelectedMeses(prev => 
      prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]
    );
    // Reset distribution when months change
    setSuggestedDistribution([]);
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

    if (filteredHistoricalData.length === 0) {
      toast.error("No hay datos históricos en los meses seleccionados");
      return;
    }

    const budget = parseFloat(totalBudget);

    console.log("Datos filtrados totales:", filteredHistoricalData.length);

    // Calculate average sales from ventasData using the same formula as main calculation
    // Promedio = Σ(Ventas en Meses de Referencia) / Cantidad de Meses de Referencia
    const brandEmpresaData = new Map<string, { empresa: string; totalVentas: number; totalPresupuesto: number }>();
    
    // First, get sales data from ventasData for selected months and available brands
    const ventasMesesSeleccionados = ventasData.filter(v => selectedMeses.includes(v.mesAnio));
    
    ventasMesesSeleccionados.forEach(venta => {
      const key = `${venta.marca}|${venta.empresa}`;
      const current = brandEmpresaData.get(key);
      if (current) {
        current.totalVentas += venta.venta;
      } else {
        brandEmpresaData.set(key, { empresa: venta.empresa, totalVentas: venta.venta, totalPresupuesto: 0 });
      }
    });

    // Add historical budget data
    filteredHistoricalData.forEach(item => {
      const key = `${item.marca}|${item.empresa}`;
      const current = brandEmpresaData.get(key);
      if (current) {
        current.totalPresupuesto += item.presupuesto;
      } else {
        brandEmpresaData.set(key, { empresa: item.empresa, totalVentas: 0, totalPresupuesto: item.presupuesto });
      }
    });

    console.log("Datos por marca+empresa:", Object.fromEntries(brandEmpresaData));

    // Calculate average sales per brand using the formula
    const validBrands = Array.from(brandEmpresaData.entries())
      .filter(([_, data]) => data.totalPresupuesto > 0 && data.totalVentas > 0)
      .map(([key, data]) => {
        const [marca] = key.split('|');
        const promedioVenta = data.totalVentas / selectedMeses.length; // Promedio = Σ(Ventas) / Cantidad de Meses
        return { marca, empresa: data.empresa, total: data.totalPresupuesto, promedioVenta };
      });

    if (validBrands.length === 0) {
      toast.error("No hay marcas con ventas y presupuesto en los meses seleccionados");
      return;
    }

    const totalHistorical = validBrands.reduce((sum, item) => sum + item.total, 0);

    // Calculate percentage participation and suggested amounts
    const distribution = validBrands
      .map(item => {
        const porcentaje = (item.total / totalHistorical) * 100;
        const monto = (budget * porcentaje) / 100;
        return { marca: item.marca, empresa: item.empresa, porcentaje, monto, promedioVenta: item.promedioVenta };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    setSuggestedDistribution(distribution);
    
    // Show average sales info
    const promedioTotal = validBrands.reduce((sum, item) => sum + item.promedioVenta, 0);
    const promedioGeneral = promedioTotal / validBrands.length;
    
    toast.success(`Presupuesto distribuido entre ${distribution.length} marcas`);
    toast.info(`Promedio de ventas en meses seleccionados: $${promedioGeneral.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`);
  };

  const handleApply = () => {
    if (suggestedDistribution.length === 0) {
      toast.error("Primero calcule la distribución sugerida");
      return;
    }

    const marcasPresupuesto = suggestedDistribution.map(item => ({
      marca: item.marca,
      fechaDestino: targetDate,
      empresa: item.empresa,
      presupuesto: item.monto
    }));

    onApplySuggestion(marcasPresupuesto);
    toast.success("Presupuesto sugerido aplicado exitosamente");
    setIsOpen(false);
    resetForm();
  };

  const handleDownload = () => {
    if (suggestedDistribution.length === 0) {
      toast.error("Primero calcule la distribución sugerida");
      return;
    }

    const excelData = suggestedDistribution.map(item => ({
      Marca: item.marca,
      Empresa: item.empresa,
      Fecha: targetDate,
      Presupuesto: item.monto,
      Porcentaje: `${item.porcentaje.toFixed(2)}%`
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
            Seleccione los meses de referencia y la distribución se calculará automáticamente basándose en el comportamiento histórico
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Months selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Meses de Referencia *</Label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {mesesDisponibles.map((mes) => (
                <div key={mes} className="flex items-center space-x-2">
                  <Checkbox
                    id={`mes-${mes}`}
                    checked={selectedMeses.includes(mes)}
                    onCheckedChange={() => handleMesToggle(mes)}
                  />
                  <Label
                    htmlFor={`mes-${mes}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {mes}
                  </Label>
                </div>
              ))}
            </div>
            {selectedMeses.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedMeses.length} {selectedMeses.length === 1 ? 'mes seleccionado' : 'meses seleccionados'}
              </p>
            )}
          </div>

          {/* Show inputs only if months are selected */}
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
                            Promedio: ${item.promedioVenta.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>{item.empresa}</TableCell>
                        <TableCell className="text-right">
                          {item.porcentaje.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right">
                          ${item.monto.toLocaleString("es-ES", {
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
                        ${parseFloat(totalBudget).toLocaleString("es-ES", {
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