import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  }>;
  marcasDisponibles: string[];
  empresasDisponibles: string[];
  onApplySuggestion: (marcas: Array<{ marca: string; fechaDestino: string; empresa: string; presupuesto: number }>) => void;
}

export const SuggestedBudget = ({ historicalData, marcasDisponibles, empresasDisponibles, onApplySuggestion }: SuggestedBudgetProps) => {
  const [totalBudget, setTotalBudget] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>(empresasDisponibles[0] || "");
  const [suggestedDistribution, setSuggestedDistribution] = useState<Array<{ marca: string; porcentaje: number; monto: number }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  const calculateSuggestion = () => {
    if (!totalBudget || parseFloat(totalBudget) <= 0) {
      toast.error("Ingrese un monto de presupuesto válido");
      return;
    }

    if (!targetDate) {
      toast.error("Seleccione una fecha destino");
      return;
    }

    const budget = parseFloat(totalBudget);

    // Filter historical data by selected empresa
    const empresaData = historicalData.filter(d => d.empresa === selectedEmpresa);

    if (empresaData.length === 0) {
      toast.warning("No hay datos históricos para esta empresa. Se distribuirá equitativamente.");
      
      // Equal distribution if no historical data
      const equalShare = budget / marcasDisponibles.length;
      const distribution = marcasDisponibles.map(marca => ({
        marca,
        porcentaje: 100 / marcasDisponibles.length,
        monto: equalShare
      }));
      
      setSuggestedDistribution(distribution);
      return;
    }

    // Calculate total historical budget per brand
    const brandTotals = new Map<string, number>();
    empresaData.forEach(item => {
      const current = brandTotals.get(item.marca) || 0;
      brandTotals.set(item.marca, current + item.presupuesto);
    });

    const totalHistorical = Array.from(brandTotals.values()).reduce((sum, val) => sum + val, 0);

    if (totalHistorical === 0) {
      toast.warning("Los datos históricos no tienen presupuestos válidos. Se distribuirá equitativamente.");
      
      const equalShare = budget / marcasDisponibles.length;
      const distribution = marcasDisponibles.map(marca => ({
        marca,
        porcentaje: 100 / marcasDisponibles.length,
        monto: equalShare
      }));
      
      setSuggestedDistribution(distribution);
      return;
    }

    // Calculate percentage participation and suggested amounts
    const distribution = Array.from(brandTotals.entries())
      .map(([marca, total]) => {
        const porcentaje = (total / totalHistorical) * 100;
        const monto = (budget * porcentaje) / 100;
        return { marca, porcentaje, monto };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    setSuggestedDistribution(distribution);
    toast.success(`Presupuesto distribuido basado en ${empresaData.length} registros históricos`);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Presupuesto Sugerido por Marca
          </DialogTitle>
          <DialogDescription>
            Ingrese el monto total y la distribución se calculará automáticamente basándose en el comportamiento histórico de cada marca
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa *</Label>
            <select
              id="empresa"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {empresasDisponibles.map(empresa => (
                <option key={empresa} value={empresa}>{empresa}</option>
              ))}
            </select>
          </div>

          <Button onClick={calculateSuggestion} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            Calcular Distribución
          </Button>

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
