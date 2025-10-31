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
  onApplySuggestion: (marcas: Array<{ marca: string; fechaDestino: string; empresa: string; presupuesto: number }>) => void;
}

export const SuggestedBudget = ({ 
  historicalData, 
  marcasDisponibles, 
  empresasDisponibles, 
  mesesDisponibles,
  onApplySuggestion 
}: SuggestedBudgetProps) => {
  const [totalBudget, setTotalBudget] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [selectedMeses, setSelectedMeses] = useState<string[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [suggestedDistribution, setSuggestedDistribution] = useState<Array<{ marca: string; porcentaje: number; monto: number }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Convert date format from YYYY-MM-DD to month-year format (e.g., "diciembre-2024")
  const convertDateToMesAnio = (dateStr: string): string => {
    // Split the date string to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
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

  // Get available empresas based on filtered data
  const availableEmpresas = useMemo(() => {
    const empresas = new Set(filteredHistoricalData.map(item => item.empresa));
    return Array.from(empresas);
  }, [filteredHistoricalData]);

  // Update selected empresa when available empresas change
  useMemo(() => {
    if (availableEmpresas.length > 0 && !availableEmpresas.includes(selectedEmpresa)) {
      setSelectedEmpresa(availableEmpresas[0]);
    }
  }, [availableEmpresas, selectedEmpresa]);

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

    if (!selectedEmpresa) {
      toast.error("No hay empresas disponibles con datos en los meses seleccionados");
      return;
    }

    const budget = parseFloat(totalBudget);

    // Filter data by selected empresa and months (already filtered in filteredHistoricalData)
    const empresaData = filteredHistoricalData.filter(d => d.empresa === selectedEmpresa);

    console.log("Datos filtrados para empresa:", selectedEmpresa, empresaData);

    if (empresaData.length === 0) {
      toast.error("No hay datos históricos para esta empresa en los meses seleccionados");
      return;
    }

    // Calculate total historical budget per brand (only brands with positive budgets)
    const brandTotals = new Map<string, number>();
    empresaData.forEach(item => {
      const current = brandTotals.get(item.marca) || 0;
      brandTotals.set(item.marca, current + item.presupuesto);
    });

    console.log("Totales por marca:", Object.fromEntries(brandTotals));

    // Filter out brands with zero total
    const validBrands = Array.from(brandTotals.entries()).filter(([_, total]) => total > 0);

    if (validBrands.length === 0) {
      toast.error("No hay marcas con presupuesto válido en los meses seleccionados");
      return;
    }

    const totalHistorical = validBrands.reduce((sum, [_, total]) => sum + total, 0);

    // Calculate percentage participation and suggested amounts
    const distribution = validBrands
      .map(([marca, total]) => {
        const porcentaje = (total / totalHistorical) * 100;
        const monto = (budget * porcentaje) / 100;
        return { marca, porcentaje, monto };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    setSuggestedDistribution(distribution);
    toast.success(`Presupuesto distribuido entre ${distribution.length} marcas basado en ${empresaData.length} registros históricos`);
  };

  const handleApply = () => {
    if (suggestedDistribution.length === 0) {
      toast.error("Primero calcule la distribución sugerida");
      return;
    }

    const marcasPresupuesto = suggestedDistribution.map(item => ({
      marca: item.marca,
      fechaDestino: targetDate,
      empresa: selectedEmpresa,
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
      Fecha: targetDate,
      Empresa: selectedEmpresa,
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

          {/* Show empresa selector only if months are selected */}
          {selectedMeses.length > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa *</Label>
                {availableEmpresas.length > 0 ? (
                  <select
                    id="empresa"
                    value={selectedEmpresa}
                    onChange={(e) => setSelectedEmpresa(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {availableEmpresas.map(empresa => (
                      <option key={empresa} value={empresa}>{empresa}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    No hay empresas con datos históricos en los meses seleccionados
                  </p>
                )}
              </div>

              {availableEmpresas.length > 0 && (
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
              )}

              {availableEmpresas.length > 0 && (
                <Button onClick={calculateSuggestion} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Calcular Distribución
                </Button>
              )}
            </>
          )}

          {suggestedDistribution.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Participación</TableHead>
                      <TableHead className="text-right">Monto Sugerido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestedDistribution.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.marca}</TableCell>
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
                      <TableCell>Total</TableCell>
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