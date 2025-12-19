import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VendorAdjustment {
  amount: number;
  percentage: number;
  fixedField: "amount" | "percentage" | null;
}

interface VendorAdjustmentProps {
  vendedores: string[];
  presupuestoTotal: number;
  onAdjust: (adjustments: Record<string, VendorAdjustment>) => void;
  marcasPresupuesto: Array<{ marca: string; empresa: string; presupuesto: number; fechaDestino: string }>;
  userId: string;
  userRole: string | null;
  result: any; // Resultado actual del cálculo
}

export const VendorAdjustment = ({
  vendedores,
  presupuestoTotal,
  onAdjust,
  marcasPresupuesto,
  userId,
  userRole,
  result,
}: VendorAdjustmentProps) => {
  const [open, setOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, VendorAdjustment>>({});
  const [fixedVendors, setFixedVendors] = useState<Set<string>>(new Set());

  // Initialize with current situation (not equal distribution)
  useEffect(() => {
    if (vendedores.length > 0 && presupuestoTotal > 0 && result) {
      const initialAdjustments: Record<string, VendorAdjustment> = {};

      // Calculate current budget for each vendor from result
      vendedores.forEach((vendedor) => {
        let totalVendedor = 0;

        // Sum all clients of this vendor across all brands
        result.resultadosMarcas?.forEach((marca: any) => {
          marca.distribucionClientes?.forEach((cliente: any) => {
            if (cliente.vendedor === vendedor) {
              totalVendedor += cliente.subtotal || 0;
            }
          });
        });

        const percentage = presupuestoTotal > 0 ? (totalVendedor / presupuestoTotal) * 100 : 0;

        initialAdjustments[vendedor] = {
          amount: totalVendedor,
          percentage: percentage,
          fixedField: null,
        };
      });

      setAdjustments(initialAdjustments);
      setFixedVendors(new Set());
    }
  }, [vendedores, presupuestoTotal, result]);

  const handleAmountChange = (vendedor: string, value: string) => {
    const numValue = parseFloat(value) || 0;

    // Mark this vendor as fixed by amount
    const newFixedVendors = new Set(fixedVendors);
    newFixedVendors.add(vendedor);
    setFixedVendors(newFixedVendors);

    const newAdjustments = { ...adjustments };

    // Update this vendor's amount and calculate percentage
    newAdjustments[vendedor] = {
      amount: numValue,
      percentage: presupuestoTotal > 0 ? (numValue / presupuestoTotal) * 100 : 0,
      fixedField: "amount",
    };

    // Get unfixed vendors
    const unfixedVendors = vendedores.filter((v) => !newFixedVendors.has(v));

    if (unfixedVendors.length > 0) {
      // Calculate remaining amount for unfixed vendors
      const totalFixed = vendedores
        .filter((v) => newFixedVendors.has(v))
        .reduce((sum, v) => sum + newAdjustments[v].amount, 0);

      const remainingAmount = presupuestoTotal - totalFixed;
      const amountPerUnfixed = remainingAmount / unfixedVendors.length;

      unfixedVendors.forEach((v) => {
        const amount = Math.max(0, amountPerUnfixed);
        newAdjustments[v] = {
          amount,
          percentage: presupuestoTotal > 0 ? (amount / presupuestoTotal) * 100 : 0,
          fixedField: newAdjustments[v]?.fixedField || null,
        };
      });
    }

    setAdjustments(newAdjustments);
  };

  const handlePercentageChange = (vendedor: string, value: string) => {
    const numValue = parseFloat(value) || 0;

    // Mark this vendor as fixed by percentage
    const newFixedVendors = new Set(fixedVendors);
    newFixedVendors.add(vendedor);
    setFixedVendors(newFixedVendors);

    const newAdjustments = { ...adjustments };

    // Update this vendor's percentage and calculate amount
    newAdjustments[vendedor] = {
      percentage: numValue,
      amount: (presupuestoTotal * numValue) / 100,
      fixedField: "percentage",
    };

    // Get unfixed vendors
    const unfixedVendors = vendedores.filter((v) => !newFixedVendors.has(v));

    if (unfixedVendors.length > 0) {
      // Calculate remaining percentage for unfixed vendors
      const totalFixedPercentage = vendedores
        .filter((v) => newFixedVendors.has(v))
        .reduce((sum, v) => sum + newAdjustments[v].percentage, 0);

      const remainingPercentage = 100 - totalFixedPercentage;
      const percentagePerUnfixed = remainingPercentage / unfixedVendors.length;

      unfixedVendors.forEach((v) => {
        const percentage = Math.max(0, percentagePerUnfixed);
        newAdjustments[v] = {
          percentage,
          amount: (presupuestoTotal * percentage) / 100,
          fixedField: newAdjustments[v]?.fixedField || null,
        };
      });
    }

    setAdjustments(newAdjustments);
  };

  const handleApply = async () => {
    const totalAmount = Object.values(adjustments).reduce((sum, adj) => sum + adj.amount, 0);
    const totalPercentage = Object.values(adjustments).reduce((sum, adj) => sum + adj.percentage, 0);

    // Validate totals (allow small rounding errors)
    if (Math.abs(totalAmount - presupuestoTotal) > 0.01) {
      toast.error(
        `Error: La suma de montos debe ser exactamente $${presupuestoTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}. Actual: $${totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`,
      );
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error(`Error: La suma de porcentajes debe ser exactamente 100%. Actual: ${totalPercentage.toFixed(2)}%`);
      return;
    }

    const changedVendors = Object.entries(adjustments).filter(([v, adj]) => adj.fixedField !== null);

    if (changedVendors.length > 0) {
      const message = changedVendors
        .map(
          ([v, adj]) =>
            `${v} ($${adj.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} / ${adj.percentage.toFixed(2)}%)`,
        )
        .join(", ");
      toast.success(`Ajuste aplicado: ${message}`);
    }

    // Save adjustments to database
    try {
      const updates = marcasPresupuesto.map((mp) => ({
        user_id: userId,
        marca: mp.marca,
        empresa: mp.empresa,
        presupuesto: mp.presupuesto,
        fecha_destino: mp.fechaDestino,
        vendor_adjustments: adjustments,
        role: (userRole as "administrador" | "gerente" | "admin_ventas") || "administrador",
      }));

      // First delete existing entries for these brands
      const marcasToUpdate = [...new Set(updates.map((u) => u.marca))];
      await supabase.from("budgets").delete().eq("user_id", userId).in("marca", marcasToUpdate);

      // Then insert new values
      const { error } = await supabase.from("budgets").insert(updates);

      if (error) throw error;
      toast.success("Ajustes guardados en la base de datos");
    } catch (error) {
      console.error("Error saving vendor adjustments:", error);
      toast.error("Error al guardar ajustes");
    }

    onAdjust(adjustments);
    setOpen(false);
  };

  const totalAmount = Object.values(adjustments).reduce((sum, adj) => sum + adj.amount, 0);
  const totalPercentage = Object.values(adjustments).reduce((sum, adj) => sum + adj.percentage, 0);
  const isValid = Math.abs(totalAmount - presupuestoTotal) < 0.01 && Math.abs(totalPercentage - 100) < 0.01;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Ajustar Vendedores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar Distribución de Vendedores</DialogTitle>
          <DialogDescription>
            Modifique el monto ($) o porcentaje (%) de cualquier vendedor. Al ajustar uno, el otro se calcula
            automáticamente. Los vendedores no ajustados se redistribuyen equitativamente. El total siempre debe sumar
            100% o el presupuesto total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant={isValid ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isValid
                ? `✓ Distribución válida - Total: $${totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} (${totalPercentage.toFixed(2)}%)`
                : `⚠ Total: $${totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} (${totalPercentage.toFixed(2)}%) - Esperado: $${presupuestoTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })} (100%)`}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 py-4">
            {vendedores.map((vendedor) => {
              const adj = adjustments[vendedor];
              const isFixed = fixedVendors.has(vendedor);

              if (!adj) return null;

              return (
                <div key={vendedor} className="grid grid-cols-12 items-center gap-3 p-3 rounded-lg border bg-card">
                  <Label className="col-span-3 font-medium">
                    {vendedor}
                    {isFixed && <span className="ml-2 text-xs text-primary">(Fijo)</span>}
                  </Label>

                  <div className="col-span-4 space-y-1">
                    <Label htmlFor={`${vendedor}-amount`} className="text-xs text-muted-foreground">
                      Monto ($)
                      {adj.fixedField === "amount" && <Lock className="inline h-3 w-3 ml-1 text-primary" />}
                    </Label>
                    <Input
                      id={`${vendedor}-amount`}
                      type="number"
                      step="0.01"
                      value={adj.amount.toFixed(2)}
                      onChange={(e) => handleAmountChange(vendedor, e.target.value)}
                      className={adj.fixedField === "amount" ? "border-primary font-semibold" : ""}
                    />
                  </div>

                  <div className="col-span-4 space-y-1">
                    <Label htmlFor={`${vendedor}-percentage`} className="text-xs text-muted-foreground">
                      Porcentaje (%)
                      {adj.fixedField === "percentage" && <Lock className="inline h-3 w-3 ml-1 text-primary" />}
                    </Label>
                    <Input
                      id={`${vendedor}-percentage`}
                      type="number"
                      step="0.01"
                      value={adj.percentage.toFixed(2)}
                      onChange={(e) => handlePercentageChange(vendedor, e.target.value)}
                      className={adj.fixedField === "percentage" ? "border-primary font-semibold" : ""}
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    {adj.fixedField && <Lock className="h-4 w-4 text-primary mx-auto" title="Campo fijo" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Resumen de Distribución:</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Asignado:</span>
                <span className="font-semibold">
                  ${totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Porcentaje:</span>
                <span className="font-semibold">{totalPercentage.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Presupuesto Total:</span>
                <span className="font-semibold">
                  ${presupuestoTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendedores Ajustados:</span>
                <span className="font-semibold">
                  {fixedVendors.size} de {vendedores.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!isValid}>
            Aplicar Ajustes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
