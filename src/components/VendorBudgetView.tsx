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
      setLoading(true);
      
      // Obtener el user_id actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuario no autenticado");
        return;
      }

      // Get user's role to filter data
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const userRoleId = userRole?.role_id;

      // Get allowed marca IDs based on role
      const { data: allowedMarcasRes } = await supabase
        .from("marcas_per_role")
        .select("marca_id")
        .eq("role_id", userRoleId);

      const allowedMarcaIds = allowedMarcasRes?.map(m => m.marca_id) || [];

      // Primero, obtener el código de la marca desde la tabla marcas (filtered by role)
      let marcaQuery = supabase
        .from('marcas')
        .select('codigo')
        .eq('nombre', budget.marca);
      
      if (allowedMarcaIds.length > 0) {
        marcaQuery = marcaQuery.in('id', allowedMarcaIds);
      }
      
      const { data: marcaData, error: marcaError } = await marcaQuery.single();

      if (marcaError) {
        console.error("Error al buscar código de marca:", marcaError);
        toast.error("No se encontró el código de la marca o no tiene permisos");
        return;
      }

      if (!marcaData) {
        toast.error("No se encontró la marca en la base de datos o no tiene permisos");
        return;
      }

      // Obtener ventas reales con el código de la marca (ventas_reales visible to all)
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas_reales')
        .select('codigo_cliente, monto')
        .eq('codigo_marca', marcaData.codigo);

      if (ventasError) throw ventasError;

      if (!ventas || ventas.length === 0) {
        toast.info("No hay ventas registradas para esta marca");
        setDistributions([]);
        return;
      }

      // Get allowed cliente IDs based on role
      const { data: allowedClientesRes } = await supabase
        .from("clientes_per_role")
        .select("cliente_id")
        .eq("role_id", userRoleId);

      const allowedClienteIds = allowedClientesRes?.map(c => c.cliente_id) || [];

      // Obtener los nombres de los clientes (filtered by role)
      const codigosClientes = Array.from(new Set(ventas.map(v => v.codigo_cliente)));
      let clientesQuery = supabase
        .from('clientes')
        .select('id, codigo, nombre')
        .in('codigo', codigosClientes);
      
      if (allowedClienteIds.length > 0) {
        clientesQuery = clientesQuery.in('id', allowedClienteIds);
      }
      
      const { data: clientes, error: clientesError } = await clientesQuery;

      if (clientesError) throw clientesError;

      // Crear mapa de códigos a nombres
      const clienteMap = new Map(clientes?.map(c => [c.codigo, c.nombre]) || []);

      // Agrupar ventas por cliente
      const clientSalesMap = new Map<string, number>();
      ventas.forEach(venta => {
        const nombreCliente = clienteMap.get(venta.codigo_cliente);
        if (nombreCliente) {
          const current = clientSalesMap.get(nombreCliente) || 0;
          clientSalesMap.set(nombreCliente, current + venta.monto);
        }
      });

      // Crear distribuciones usando nombres de clientes
      const total = Array.from(clientSalesMap.values()).reduce((sum, val) => sum + val, 0);
      const dists: ClientDistribution[] = Array.from(clientSalesMap.entries()).map(([nombreCliente, monto]) => {
        const proportion = total > 0 ? monto / total : 0;
        const monto_original = budget.presupuesto * proportion;
        
        // Verificar si hay ajustes guardados (también usando nombres)
        const adjustments = budget.vendor_adjustments || {};
        const monto_asignado = adjustments[nombreCliente] !== undefined 
          ? adjustments[nombreCliente] 
          : monto_original;

        return {
          cliente: nombreCliente,
          monto_original,
          monto_asignado
        };
      });

      setDistributions(dists);
    } catch (error: any) {
      toast.error("Error al cargar distribuciones");
      console.error(error);
    } finally {
      setLoading(false);
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
