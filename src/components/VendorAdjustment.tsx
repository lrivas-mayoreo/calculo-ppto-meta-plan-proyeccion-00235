import { useState } from "react";
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
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface VendorAdjustmentProps {
  vendedores: string[];
  presupuestoTotal: number;
  onAdjust: (adjustments: Record<string, { value: number; type: "percentage" | "currency" }>) => void;
}

export const VendorAdjustment = ({ vendedores, presupuestoTotal, onAdjust }: VendorAdjustmentProps) => {
  const [open, setOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"percentage" | "currency">("percentage");
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    vendedores.reduce((acc, v) => ({ ...acc, [v]: adjustmentType === "percentage" ? 100 : presupuestoTotal / vendedores.length }), {})
  );
  const [lockedVendors, setLockedVendors] = useState<Set<string>>(new Set());

  const handleAdjustmentChange = (vendedor: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    // Check if we can add another lock (n-1 limit)
    if (!lockedVendors.has(vendedor) && lockedVendors.size >= vendedores.length - 1) {
      toast.error(`Límite alcanzado: máximo ${vendedores.length - 1} ajustes permitidos`);
      return;
    }

    const newAdjustments = { ...adjustments, [vendedor]: numValue };
    const newLockedVendors = new Set(lockedVendors);
    newLockedVendors.add(vendedor);

    // Find the unlocked vendor (the one that will receive the difference)
    const unlockedVendor = vendedores.find(v => !newLockedVendors.has(v));
    
    if (unlockedVendor) {
      if (adjustmentType === "percentage") {
        const totalLocked = Object.entries(newAdjustments)
          .filter(([v]) => newLockedVendors.has(v))
          .reduce((sum, [_, val]) => sum + val, 0);
        const remaining = vendedores.length * 100 - totalLocked;
        newAdjustments[unlockedVendor] = Math.max(0, remaining);
      } else {
        const totalLocked = Object.entries(newAdjustments)
          .filter(([v]) => newLockedVendors.has(v))
          .reduce((sum, [_, val]) => sum + val, 0);
        const remaining = presupuestoTotal - totalLocked;
        newAdjustments[unlockedVendor] = Math.max(0, remaining);
      }
    }

    setAdjustments(newAdjustments);
    setLockedVendors(newLockedVendors);
  };

  const handleTypeChange = (newType: "percentage" | "currency") => {
    setAdjustmentType(newType);
    setLockedVendors(new Set());
    
    const baseValue = newType === "percentage" ? 100 : presupuestoTotal / vendedores.length;
    setAdjustments(vendedores.reduce((acc, v) => ({ ...acc, [v]: baseValue }), {}));
  };

  const handleApply = () => {
    const total = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
    const expectedTotal = adjustmentType === "percentage" 
      ? vendedores.length * 100 
      : presupuestoTotal;
    
    if (Math.abs(total - expectedTotal) > 0.01) {
      toast.error(
        adjustmentType === "percentage"
          ? "La suma de los porcentajes debe ser igual al 100% por vendedor"
          : "La suma de los montos debe ser igual al presupuesto total"
      );
      return;
    }

    const adjustmentsWithType = Object.fromEntries(
      Object.entries(adjustments).map(([vendor, value]) => [
        vendor,
        { value, type: adjustmentType }
      ])
    );

    const changedVendors = Object.entries(adjustments).filter(
      ([v, val]) => adjustmentType === "percentage" ? val !== 100 : val !== presupuestoTotal / vendedores.length
    );
    
    if (changedVendors.length > 0) {
      const message = changedVendors
        .map(([v, val]) => 
          adjustmentType === "percentage" 
            ? `${v} (${val.toFixed(2)}%)`
            : `${v} ($${val.toLocaleString("es-ES", { minimumFractionDigits: 2 })})`
        )
        .join(", ");
      toast.warning(`Ajuste aplicado: ${message}`);
    }

    onAdjust(adjustmentsWithType);
    setOpen(false);
  };

  const totalValue = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
  const expectedTotal = adjustmentType === "percentage" ? vendedores.length * 100 : presupuestoTotal;
  const isValid = Math.abs(totalValue - expectedTotal) < 0.01;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Ajustar Vendedores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar Distribución de Vendedores</DialogTitle>
          <DialogDescription>
            Ajuste hasta {vendedores.length - 1} vendedores. El último se ajusta automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Tipo de Ajuste</Label>
            <Select value={adjustmentType} onValueChange={handleTypeChange}>
              <SelectTrigger id="adjustment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                <SelectItem value="currency">Moneda ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert variant={isValid ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isValid
                ? `Distribución válida - ${lockedVendors.size} de ${vendedores.length - 1} ajustes usados`
                : adjustmentType === "percentage"
                ? `Total: ${totalValue.toFixed(2)}% - Esperado: ${expectedTotal}%`
                : `Total: $${totalValue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} - Esperado: $${expectedTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 py-4">
            {vendedores.map((vendedor) => {
              const isLocked = lockedVendors.has(vendedor);
              const isAutoCalculated = !isLocked && lockedVendors.size === vendedores.length - 1;
              
              return (
                <div key={vendedor} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={vendedor} className="col-span-2">
                    {vendedor}
                    {isAutoCalculated && (
                      <span className="ml-2 text-xs text-muted-foreground">(auto)</span>
                    )}
                  </Label>
                  <Input
                    id={vendedor}
                    type="number"
                    step="0.01"
                    value={adjustments[vendedor]?.toFixed(2) || 0}
                    onChange={(e) => handleAdjustmentChange(vendedor, e.target.value)}
                    className="col-span-2"
                    disabled={isAutoCalculated}
                  />
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">Presupuesto Total por Vendedor:</p>
            <div className="mt-2 space-y-1">
              {vendedores.map((vendedor) => {
                const value = adjustments[vendedor] || 0;
                const budget = adjustmentType === "percentage"
                  ? (presupuestoTotal * value) / 100
                  : value;
                
                return (
                  <div key={vendedor} className="flex justify-between">
                    <span>{vendedor}:</span>
                    <span className="font-semibold">
                      ${budget.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {adjustmentType === "percentage" && ` (${value.toFixed(2)}%)`}
                    </span>
                  </div>
                );
              })}
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
