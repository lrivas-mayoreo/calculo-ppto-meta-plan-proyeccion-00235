import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, AlertTriangle, Lock, Search, Plus, X, UserCheck } from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  result: any;
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
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Vendedores seleccionados para ajustar
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  
  // Ajustes locales (no aplicados aún)
  const [localAdjustments, setLocalAdjustments] = useState<Record<string, VendorAdjustment>>({});
  
  // Valores originales del resultado actual (snapshot al abrir el diálogo)
  const [originalValues, setOriginalValues] = useState<Record<string, { amount: number; percentage: number }>>({});

  // Calcular valores originales desde el resultado
  const calculateOriginalValues = () => {
    const values: Record<string, { amount: number; percentage: number }> = {};
    
    vendedores.forEach((vendedor) => {
      let totalVendedor = 0;
      
      result?.resultadosMarcas?.forEach((marca: any) => {
        marca.distribucionClientes?.forEach((cliente: any) => {
          if (cliente.vendedor === vendedor) {
            totalVendedor += cliente.subtotal || 0;
          }
        });
      });
      
      const percentage = presupuestoTotal > 0 ? (totalVendedor / presupuestoTotal) * 100 : 0;
      values[vendedor] = { amount: totalVendedor, percentage };
    });
    
    return values;
  };

  // Al abrir el diálogo, guardar snapshot de valores originales
  useEffect(() => {
    if (open && result) {
      const originals = calculateOriginalValues();
      setOriginalValues(originals);
      setLocalAdjustments({});
      setSelectedVendors([]);
      setSearchQuery("");
    }
  }, [open, result, vendedores, presupuestoTotal]);

  // Filtrar vendedores disponibles (no seleccionados aún)
  const filteredVendors = useMemo(() => {
    return vendedores.filter(
      (v) => !selectedVendors.includes(v) && v.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vendedores, selectedVendors, searchQuery]);

  // Agregar vendedor a la lista de seleccionados
  const handleAddVendor = (vendedor: string) => {
    setSelectedVendors((prev) => [...prev, vendedor]);
    // Inicializar con valores originales
    const original = originalValues[vendedor] || { amount: 0, percentage: 0 };
    setLocalAdjustments((prev) => ({
      ...prev,
      [vendedor]: {
        amount: original.amount,
        percentage: original.percentage,
        fixedField: null,
      },
    }));
    setSearchQuery("");
  };

  // Quitar vendedor de la lista
  const handleRemoveVendor = (vendedor: string) => {
    setSelectedVendors((prev) => prev.filter((v) => v !== vendedor));
    setLocalAdjustments((prev) => {
      const newAdj = { ...prev };
      delete newAdj[vendedor];
      return newAdj;
    });
  };

  // Cambiar monto (bloquea el otro campo)
  const handleAmountChange = (vendedor: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalAdjustments((prev) => ({
      ...prev,
      [vendedor]: {
        amount: numValue,
        percentage: presupuestoTotal > 0 ? (numValue / presupuestoTotal) * 100 : 0,
        fixedField: "amount",
      },
    }));
  };

  // Cambiar porcentaje (bloquea el otro campo)
  const handlePercentageChange = (vendedor: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalAdjustments((prev) => ({
      ...prev,
      [vendedor]: {
        percentage: numValue,
        amount: (presupuestoTotal * numValue) / 100,
        fixedField: "percentage",
      },
    }));
  };

  // Aplicar cambios
  const handleApply = async () => {
    if (selectedVendors.length === 0) {
      toast.error("No hay vendedores seleccionados para ajustar");
      return;
    }

    // Construir ajustes finales combinando originales con modificaciones
    const finalAdjustments: Record<string, VendorAdjustment> = {};
    let totalAssigned = 0;
    
    // Primero, agregar los ajustados
    selectedVendors.forEach((v) => {
      const adj = localAdjustments[v];
      if (adj) {
        finalAdjustments[v] = adj;
        totalAssigned += adj.amount;
      }
    });

    // Calcular cuánto queda para los no ajustados
    const remainingAmount = presupuestoTotal - totalAssigned;
    const nonAdjustedVendors = vendedores.filter((v) => !selectedVendors.includes(v));
    
    if (nonAdjustedVendors.length > 0) {
      // Redistribuir proporcionalmente basado en valores originales
      const totalOriginalNonAdjusted = nonAdjustedVendors.reduce(
        (sum, v) => sum + (originalValues[v]?.amount || 0),
        0
      );
      
      nonAdjustedVendors.forEach((v) => {
        const originalAmount = originalValues[v]?.amount || 0;
        let newAmount: number;
        
        if (totalOriginalNonAdjusted > 0) {
          // Proporcional al original
          newAmount = (originalAmount / totalOriginalNonAdjusted) * remainingAmount;
        } else {
          // Distribución equitativa si no hay valores originales
          newAmount = remainingAmount / nonAdjustedVendors.length;
        }
        
        finalAdjustments[v] = {
          amount: newAmount,
          percentage: presupuestoTotal > 0 ? (newAmount / presupuestoTotal) * 100 : 0,
          fixedField: null,
        };
      });
    }

    // Validar totales
    const totalAmount = Object.values(finalAdjustments).reduce((sum, adj) => sum + adj.amount, 0);
    const totalPercentage = Object.values(finalAdjustments).reduce((sum, adj) => sum + adj.percentage, 0);

    if (Math.abs(totalAmount - presupuestoTotal) > 1) {
      toast.error(
        `La suma de montos ($${totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}) no coincide con el presupuesto ($${presupuestoTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })})`
      );
      return;
    }

    setIsSaving(true);

    try {
      const updates = marcasPresupuesto.map((mp) => ({
        user_id: userId,
        marca: mp.marca,
        empresa: mp.empresa,
        presupuesto: mp.presupuesto,
        fecha_destino: mp.fechaDestino,
        vendor_adjustments: finalAdjustments as any,
        role: (userRole as "administrador" | "gerente" | "admin_ventas") || "administrador",
      }));

      const marcasToUpdate = [...new Set(updates.map((u) => u.marca))];
      await supabase.from("budgets").delete().eq("user_id", userId).in("marca", marcasToUpdate);

      const { error } = await supabase.from("budgets").insert(updates);

      if (error) throw error;

      const adjustedMessage = selectedVendors
        .map((v) => {
          const adj = localAdjustments[v];
          return `${v}: $${adj?.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} (${adj?.percentage.toFixed(2)}%)`;
        })
        .join(", ");

      toast.success(`Ajustes aplicados: ${adjustedMessage}`);
      onAdjust(finalAdjustments);
      setOpen(false);
    } catch (error) {
      console.error("Error saving vendor adjustments:", error);
      toast.error("Error al guardar ajustes");
    } finally {
      setIsSaving(false);
    }
  };

  // Calcular totales de los vendedores seleccionados
  const totalSelectedAmount = selectedVendors.reduce(
    (sum, v) => sum + (localAdjustments[v]?.amount || 0),
    0
  );
  const totalSelectedPercentage = selectedVendors.reduce(
    (sum, v) => sum + (localAdjustments[v]?.percentage || 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Ajustar Vendedores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajustar Distribución de Vendedores</DialogTitle>
          <DialogDescription>
            Busque y agregue vendedores para ajustar su presupuesto. Solo puede editar monto O porcentaje (no ambos).
            Los vendedores no ajustados se redistribuyen proporcionalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Buscador de vendedores */}
          <div className="space-y-2">
            <Label>Buscar y agregar vendedor</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Escriba el nombre del vendedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Resultados de búsqueda */}
            {searchQuery && filteredVendors.length > 0 && (
              <ScrollArea className="max-h-32 rounded-md border bg-popover">
                <div className="p-1">
                  {filteredVendors.slice(0, 5).map((vendedor) => (
                    <button
                      key={vendedor}
                      onClick={() => handleAddVendor(vendedor)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <span>{vendedor}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">
                          ${originalValues[vendedor]?.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 }) || "0.00"}
                        </span>
                        <Plus className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            {searchQuery && filteredVendors.length === 0 && (
              <p className="text-sm text-muted-foreground px-2">No se encontraron vendedores</p>
            )}
          </div>

          {/* Resumen de asignación */}
          <Alert variant={selectedVendors.length > 0 ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-4">
              <span>
                <strong>{selectedVendors.length}</strong> vendedor(es) seleccionado(s)
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                Asignado: <strong>${totalSelectedAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                {" "}({totalSelectedPercentage.toFixed(2)}%)
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                Restante: <strong>${(presupuestoTotal - totalSelectedAmount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                {" "}para {vendedores.length - selectedVendors.length} vendedor(es)
              </span>
            </AlertDescription>
          </Alert>

          {/* Lista de vendedores seleccionados */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-4">
              {selectedVendors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay vendedores seleccionados</p>
                  <p className="text-sm">Use el buscador para agregar vendedores</p>
                </div>
              ) : (
                selectedVendors.map((vendedor) => {
                  const adj = localAdjustments[vendedor];
                  const original = originalValues[vendedor];

                  return (
                    <div
                      key={vendedor}
                      className="grid grid-cols-12 items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="col-span-3 flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveVendor(vendedor)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div>
                          <Label className="font-medium">{vendedor}</Label>
                          <p className="text-xs text-muted-foreground">
                            Original: ${original?.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} ({original?.percentage.toFixed(2)}%)
                          </p>
                        </div>
                      </div>

                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          Monto ($)
                          {adj?.fixedField === "amount" && <Lock className="h-3 w-3 text-primary" />}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={adj?.amount.toFixed(2) || "0.00"}
                          onChange={(e) => handleAmountChange(vendedor, e.target.value)}
                          disabled={adj?.fixedField === "percentage"}
                          className={adj?.fixedField === "amount" ? "border-primary font-semibold" : ""}
                        />
                      </div>

                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          Porcentaje (%)
                          {adj?.fixedField === "percentage" && <Lock className="h-3 w-3 text-primary" />}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={adj?.percentage.toFixed(2) || "0.00"}
                          onChange={(e) => handlePercentageChange(vendedor, e.target.value)}
                          disabled={adj?.fixedField === "amount"}
                          className={adj?.fixedField === "percentage" ? "border-primary font-semibold" : ""}
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        {adj?.fixedField && <Lock className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Resumen final */}
          {selectedVendors.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Resumen de Distribución:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Presupuesto Total:</span>
                  <span className="font-semibold">
                    ${presupuestoTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Ajustado:</span>
                  <span className="font-semibold">
                    ${totalSelectedAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">% Ajustado:</span>
                  <span className="font-semibold">{totalSelectedPercentage.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendedores sin ajustar:</span>
                  <span className="font-semibold">{vendedores.length - selectedVendors.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={selectedVendors.length === 0 || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Actualizando presupuesto...
              </>
            ) : (
              "Aplicar Ajustes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
