import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, DollarSign } from "lucide-react";
import type { CalculationResult } from "@/pages/Index";

interface VendorClientTableProps {
  result: CalculationResult;
  vendorAdjustments: Record<string, { value: number; type: "percentage" | "currency" }>;
  presupuestoTotal: number;
  userRole: string | null;
}

interface VendorClientData {
  vendedor: string;
  cliente: string;
  empresa: string;
  marca: string;
  presupuestoAsignado: number;
  ventasReales: number;
  ajusteManual: number;
  key: string;
}

export const VendorClientTable = ({ result, vendorAdjustments, presupuestoTotal, userRole }: VendorClientTableProps) => {
  const [vendorClientData, setVendorClientData] = useState<VendorClientData[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
  const [editingVendor, setEditingVendor] = useState<{ key: string; newVendor: string } | null>(null);

  useEffect(() => {
    calculateVendorClientData();
  }, [result, vendorAdjustments]);

  const calculateVendorClientData = () => {
    const data: VendorClientData[] = [];

    result.resultadosMarcas.forEach((marca) => {
      marca.distribucionClientes.forEach((cliente) => {
        const key = `${cliente.vendedor}-${cliente.cliente}-${marca.marca}`;
        
        // Calculate vendor's budget based on adjustments
        let vendorBudget = presupuestoTotal / getUniqueVendors().length;
        
        if (vendorAdjustments[cliente.vendedor]) {
          const adj = vendorAdjustments[cliente.vendedor];
          if (adj.type === "percentage") {
            vendorBudget = (presupuestoTotal * adj.value) / 100;
          } else {
            vendorBudget = adj.value;
          }
        }

        // Calculate client's share of vendor's budget
        const clientShare = cliente.subtotal / marca.presupuesto;
        const presupuestoAsignado = vendorBudget * clientShare;

        data.push({
          vendedor: cliente.vendedor,
          cliente: cliente.cliente,
          empresa: cliente.empresa,
          marca: marca.marca,
          presupuestoAsignado,
          ventasReales: cliente.subtotal,
          ajusteManual: manualAdjustments[key] || 0,
          key,
        });
      });
    });

    setVendorClientData(data);
  };

  const getUniqueVendors = () => {
    return Array.from(
      new Set(
        result.resultadosMarcas.flatMap((m) =>
          m.distribucionClientes.map((c) => c.vendedor)
        )
      )
    );
  };

  const handleManualAdjustment = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setManualAdjustments((prev) => ({
      ...prev,
      [key]: numValue,
    }));
  };

  const applyAdjustments = () => {
    calculateVendorClientData();
    toast.success("Ajustes aplicados exitosamente");
  };

  const handleVendorChange = (key: string, newVendor: string) => {
    setEditingVendor({ key, newVendor });
  };

  const applyVendorChange = () => {
    if (!editingVendor) return;
    
    const updatedData = vendorClientData.map(item => {
      if (item.key === editingVendor.key) {
        return { ...item, vendedor: editingVendor.newVendor };
      }
      return item;
    });
    
    setVendorClientData(updatedData);
    setEditingVendor(null);
    toast.success("Vendedor actualizado exitosamente");
  };

  const uniqueVendors = getUniqueVendors();
  const canEdit = userRole === "admin_ventas" || userRole === "administrador";
  const isReadOnly = userRole === "gerente";

  const vendorTotals = vendorClientData.reduce((acc, item) => {
    const current = acc[item.vendedor] || 0;
    acc[item.vendedor] = current + item.presupuestoAsignado + item.ajusteManual;
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = Object.values(vendorTotals).reduce((sum, val) => sum + val, 0);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Vendedores y Clientes</h3>
          {isReadOnly && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Solo lectura</span>
          )}
        </div>
        <div className="flex gap-2">
          {editingVendor && canEdit && (
            <Button onClick={applyVendorChange} size="sm" variant="default">
              Confirmar Cambio
            </Button>
          )}
          {!isReadOnly && (
            <Button onClick={applyAdjustments} size="sm">
              Aplicar Ajustes
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-right">Presupuesto Base</TableHead>
              <TableHead className="text-right">Ventas Reales</TableHead>
              <TableHead className="text-right">Ajuste Manual</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendorClientData.map((item, index) => {
              const key = `${item.vendedor}-${item.cliente}-${item.marca}`;
              const total = item.presupuestoAsignado + item.ajusteManual;

              return (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {canEdit ? (
                      <select
                        value={editingVendor?.key === key ? editingVendor.newVendor : item.vendedor}
                        onChange={(e) => handleVendorChange(key, e.target.value)}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                      >
                        {uniqueVendors.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      item.vendedor
                    )}
                  </TableCell>
                  <TableCell>{item.cliente}</TableCell>
                  <TableCell>{item.empresa}</TableCell>
                  <TableCell>{item.marca}</TableCell>
                  <TableCell className="text-right">
                    ${item.presupuestoAsignado.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.ventasReales.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isReadOnly ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={manualAdjustments[key] || 0}
                        onChange={(e) => handleManualAdjustment(key, e.target.value)}
                        className="w-32 text-right"
                      />
                    ) : (
                      <span>${(manualAdjustments[key] || 0).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${total.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Vendor Totals */}
      <div className="mt-6 space-y-2 rounded-lg bg-muted/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <DollarSign className="h-4 w-4" />
          <span>Totales por Vendedor:</span>
        </div>
        {Object.entries(vendorTotals).map(([vendedor, total]) => (
          <div key={vendedor} className="flex justify-between text-sm">
            <span>{vendedor}:</span>
            <span className="font-semibold">
              ${total.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ))}
        <div className="mt-3 flex justify-between border-t pt-3 text-base font-bold">
          <span>Total General:</span>
          <span>
            ${grandTotal.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </Card>
  );
};
