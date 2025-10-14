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
import { Settings, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface VendorAdjustmentProps {
  vendedores: string[];
  onAdjust: (adjustments: Record<string, number>) => void;
}

export const VendorAdjustment = ({ vendedores, onAdjust }: VendorAdjustmentProps) => {
  const [open, setOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    vendedores.reduce((acc, v) => ({ ...acc, [v]: 100 }), {})
  );

  const handleAdjustmentChange = (vendedor: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAdjustments((prev) => ({
      ...prev,
      [vendedor]: numValue,
    }));
  };

  const handleApply = () => {
    const total = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
    
    if (Math.abs(total - vendedores.length * 100) > 0.01) {
      toast.error("La suma de los ajustes debe ser igual al 100% para cada vendedor");
      return;
    }

    const changedVendors = Object.entries(adjustments).filter(([_, val]) => val !== 100);
    if (changedVendors.length > 0) {
      toast.warning(
        `Ajuste aplicado: ${changedVendors.map(([v, val]) => `${v} (${val}%)`).join(", ")}`
      );
    }

    onAdjust(adjustments);
    setOpen(false);
  };

  const totalPercentage = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
  const expectedTotal = vendedores.length * 100;
  const isValid = Math.abs(totalPercentage - expectedTotal) < 0.01;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Ajustar Vendedores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajustar Distribución de Vendedores</DialogTitle>
          <DialogDescription>
            Modifique los porcentajes de distribución para cada vendedor. La diferencia se redistribuirá automáticamente.
          </DialogDescription>
        </DialogHeader>

        <Alert variant={isValid ? "default" : "destructive"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isValid
              ? "Los porcentajes son válidos"
              : `Total actual: ${totalPercentage.toFixed(2)}% - Esperado: ${expectedTotal}%`}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-4">
          {vendedores.map((vendedor) => (
            <div key={vendedor} className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor={vendedor} className="col-span-2">
                {vendedor}
              </Label>
              <Input
                id={vendedor}
                type="number"
                step="0.01"
                value={adjustments[vendedor]}
                onChange={(e) => handleAdjustmentChange(vendedor, e.target.value)}
                className="col-span-2"
              />
            </div>
          ))}
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
