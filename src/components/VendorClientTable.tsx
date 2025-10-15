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
}

interface VendorClientData {
  vendedor: string;
  cliente: string;
  empresa: string;
  marca: string;
  presupuestoAsignado: number;
  ventasReales: number;
  ajusteManual: number;
}

export const VendorClientTable = ({ result, vendorAdjustments, presupuestoTotal }: VendorClientTableProps) => {
  const [vendorClientData, setVendorClientData] = useState<VendorClientData[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});

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
        </div>
        <Button onClick={applyAdjustments} size="sm">
          Aplicar Ajustes
        </Button>
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
                  <TableCell className="font-medium">{item.vendedor}</TableCell>
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
                    <Input
                      type="number"
                      step="0.01"
                      value={manualAdjustments[key] || 0}
                      onChange={(e) => handleManualAdjustment(key, e.target.value)}
                      className="w-32 text-right"
                    />
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
