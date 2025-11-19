import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeftRight, Save } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Budget {
  id: string;
  marca: string;
  empresa: string;
  fecha_destino: string;
  presupuesto: number;
  vendor_adjustments: any;
}

interface ClientDistribution {
  cliente: string;
  monto_asignado: number;
  monto_original: number;
}

export const VendorBudgetView = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>("");
  const [distributions, setDistributions] = useState<ClientDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBudgets(data || []);
      if (data && data.length > 0 && !selectedBudget) {
        setSelectedBudget(data[0].id);
        loadDistributions(data[0]);
      }
    } catch (error: any) {
      toast.error("Error al cargar presupuestos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDistributions = async (budget: Budget) => {
    try {
      // Obtener ventas reales para calcular distribución original
      const { data: ventas, error } = await supabase
        .from('ventas_reales')
        .select('codigo_cliente, monto')
        .eq('codigo_marca', budget.marca);

      if (error) throw error;

      // Agrupar por cliente
      const clientMap = new Map<string, number>();
      ventas?.forEach(venta => {
        const current = clientMap.get(venta.codigo_cliente) || 0;
        clientMap.set(venta.codigo_cliente, current + venta.monto);
      });

      // Crear distribuciones
      const total = Array.from(clientMap.values()).reduce((sum, val) => sum + val, 0);
      const dists: ClientDistribution[] = Array.from(clientMap.entries()).map(([cliente, monto]) => {
        const proportion = total > 0 ? monto / total : 0;
        const monto_original = budget.presupuesto * proportion;
        
        // Verificar si hay ajustes guardados
        const adjustments = budget.vendor_adjustments || {};
        const monto_asignado = adjustments[cliente] !== undefined 
          ? adjustments[cliente] 
          : monto_original;

        return {
          cliente,
          monto_original,
          monto_asignado
        };
      });

      setDistributions(dists);
    } catch (error: any) {
      toast.error("Error al cargar distribuciones");
      console.error(error);
    }
  };

  const handleBudgetChange = (budgetId: string) => {
    setSelectedBudget(budgetId);
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) {
      loadDistributions(budget);
    }
  };

  const handleAmountChange = (cliente: string, newAmount: string) => {
    const amount = parseFloat(newAmount) || 0;
    setDistributions(prev =>
      prev.map(d =>
        d.cliente === cliente ? { ...d, monto_asignado: amount } : d
      )
    );
  };

  const validateAndSave = async () => {
    const budget = budgets.find(b => b.id === selectedBudget);
    if (!budget) return;

    const totalAsignado = distributions.reduce((sum, d) => sum + d.monto_asignado, 0);
    
    if (Math.abs(totalAsignado - budget.presupuesto) > 0.01) {
      toast.error(`El total asignado (${totalAsignado.toFixed(2)}) debe ser igual al presupuesto (${budget.presupuesto.toFixed(2)})`);
      return;
    }

    try {
      const adjustments: any = {};
      distributions.forEach(d => {
        adjustments[d.cliente] = d.monto_asignado;
      });

      const { error } = await supabase
        .from('budgets')
        .update({ vendor_adjustments: adjustments })
        .eq('id', selectedBudget);

      if (error) throw error;

      toast.success("Distribución guardada exitosamente");
      await loadBudgets();
    } catch (error: any) {
      toast.error("Error al guardar distribución");
      console.error(error);
    }
  };

  const currentBudget = budgets.find(b => b.id === selectedBudget);
  const totalAsignado = distributions.reduce((sum, d) => sum + d.monto_asignado, 0);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  if (budgets.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">No hay presupuestos disponibles</p>
          <p className="text-sm text-muted-foreground mt-2">
            Contacta al administrador para que cargue presupuestos
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label>Seleccionar Presupuesto</Label>
            <Select value={selectedBudget} onValueChange={handleBudgetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un presupuesto" />
              </SelectTrigger>
              <SelectContent>
                {budgets.map(budget => (
                  <SelectItem key={budget.id} value={budget.id}>
                    {budget.marca} - {budget.empresa} ({budget.fecha_destino})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentBudget && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                <p className="text-2xl font-bold">${currentBudget.presupuesto.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Asignado</p>
                <p className={`text-2xl font-bold ${
                  Math.abs(totalAsignado - currentBudget.presupuesto) > 0.01 
                    ? 'text-destructive' 
                    : 'text-green-600'
                }`}>
                  ${totalAsignado.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Redistribución de Presupuesto por Cliente
          </h3>
          <Button onClick={validateAndSave}>
            <Save className="mr-2 h-4 w-4" />
            Guardar Cambios
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto Original</TableHead>
                <TableHead className="text-right">Monto Asignado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.map(dist => (
                <TableRow key={dist.cliente}>
                  <TableCell className="font-medium">{dist.cliente}</TableCell>
                  <TableCell className="text-right">
                    ${dist.monto_original.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={dist.monto_asignado}
                      onChange={(e) => handleAmountChange(dist.cliente, e.target.value)}
                      className="w-32 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={
                      dist.monto_asignado > dist.monto_original 
                        ? 'text-green-600' 
                        : dist.monto_asignado < dist.monto_original 
                        ? 'text-red-600' 
                        : ''
                    }>
                      ${(dist.monto_asignado - dist.monto_original).toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
