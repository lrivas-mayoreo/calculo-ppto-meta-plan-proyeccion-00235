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
import { Users, DollarSign, Download } from "lucide-react";
import type { CalculationResult } from "@/pages/Index";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface VendorClientTableProps {
  result: CalculationResult;
  vendorAdjustments: Record<string, { value: number; type: "percentage" | "currency" }>;
  presupuestoTotal: number;
  userRole: string | null;
  marcasPresupuesto: Array<{ marca: string; empresa: string; presupuesto: number; fechaDestino: string }>;
  userId: string;
  onBrandAdjustmentsChange?: (adjustments: Record<string, number>) => void;
}

interface VendorClientData {
  vendedor: string;
  cliente: string;
  empresa: string;
  marca: string;
  presupuestoAsignado: number;
  ventasReales: number;
  ventaMesAnterior: number;
  ajusteManual: number;
  ajusteMarca: number;
  key: string;
}

export const VendorClientTable = ({ result, vendorAdjustments, presupuestoTotal, userRole, marcasPresupuesto, userId, onBrandAdjustmentsChange }: VendorClientTableProps) => {
  const [vendorClientData, setVendorClientData] = useState<VendorClientData[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
  const [brandAdjustments, setBrandAdjustments] = useState<Record<string, number>>({});
  const [editingVendor, setEditingVendor] = useState<{ key: string; newVendor: string } | null>(null);
  const [previousMonthSales, setPreviousMonthSales] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPreviousMonthSales();
  }, [result]);

  useEffect(() => {
    calculateVendorClientData();
  }, [result, previousMonthSales, brandAdjustments]);

  const getPreviousMonth = (fechaDestino: string): string => {
    // Parse fecha in format YYYY/MM/DD and return the full previous month range
    const parts = fechaDestino.split('/');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    
    const prevYear = date.getFullYear();
    const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
    
    // Return format YYYY/MM for querying all sales in that month
    return `${prevYear}/${prevMonth}`;
  };

  const loadPreviousMonthSales = async () => {
    const salesByKey: Record<string, number> = {};
    
    // Get user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    console.log("=== DEBUG VENTAS MES ANTERIOR ===");
    
    // Load all codes mappings - need both directions
    const [clientsRes, brandsRes] = await Promise.all([
      supabase.from('clientes').select('nombre, codigo').eq('user_id', user.id),
      supabase.from('marcas').select('nombre, codigo').eq('user_id', user.id),
    ]);
    
    console.log("Clientes cargados:", clientsRes.data?.length || 0);
    console.log("Marcas cargadas:", brandsRes.data?.length || 0);
    
    const clientCodes = new Map(clientsRes.data?.map(c => [c.nombre, c.codigo]) || []);
    const brandCodes = new Map(brandsRes.data?.map(b => [b.nombre, b.codigo]) || []);
    
    for (const marca of result.resultadosMarcas) {
      const previousMonth = getPreviousMonth(marca.fechaDestino);
      const codigoMarca = brandCodes.get(marca.marca);
      
      console.log(`Marca: ${marca.marca}, Mes anterior: ${previousMonth}, Código: ${codigoMarca}`);
      
      if (!codigoMarca) {
        console.warn(`No se encontró código para marca: ${marca.marca}`);
        continue;
      }
      
      // Get unique clients and vendors from this brand
      for (const distribucion of marca.distribucionClientes) {
        // distribucion.cliente is already a name from the calculation
        const clienteNombre = distribucion.cliente;
        const codigoCliente = clientCodes.get(clienteNombre);
        const key = `${distribucion.vendedor}-${clienteNombre}-${marca.marca}`;
        
        if (!codigoCliente) {
          console.warn(`No se encontró código para cliente: ${clienteNombre}`);
          salesByKey[key] = 0;
          continue;
        }
        
        console.log(`Consultando ventas: mes=${previousMonth}, marca=${codigoMarca}, cliente=${codigoCliente}`);
        
        // Query ventas_reales for previous month
        const { data, error } = await supabase
          .from('ventas_reales')
          .select('monto')
          .eq('mes', previousMonth)
          .eq('codigo_marca', codigoMarca)
          .eq('codigo_cliente', codigoCliente)
          .eq('user_id', user.id);
        
        if (error) {
          console.error("Error consultando ventas_reales:", error);
        }
        
        if (data && data.length > 0) {
          const total = data.reduce((sum, sale) => sum + Number(sale.monto), 0);
          salesByKey[key] = total;
          console.log(`✓ Ventas encontradas para ${key}: $${total}`);
        } else {
          salesByKey[key] = 0;
          console.log(`✗ No se encontraron ventas para ${key}`);
        }
      }
    }
    
    console.log("=== RESUMEN VENTAS MES ANTERIOR ===", salesByKey);
    setPreviousMonthSales(salesByKey);
  };

  const calculateVendorClientData = () => {
    const data: VendorClientData[] = [];

    result.resultadosMarcas.forEach((marca) => {
      const totalBrandAdjustment = brandAdjustments[marca.marca] || 0;
      
      // Calculate total brand budget (sum of all subtotals for this brand)
      const totalBrandBudget = marca.distribucionClientes.reduce((sum, cliente) => 
        sum + cliente.subtotal, 0
      );

      marca.distribucionClientes.forEach((cliente) => {
        const key = `${cliente.vendedor}-${cliente.cliente}-${marca.marca}`;
        
        // Use the already calculated subtotal as presupuestoAsignado (Ppto Asociado)
        // This comes from the formula: Venta Promedio del Artículo × Factor
        const presupuestoAsignado = cliente.subtotal;

        // Calculate proportional brand adjustment
        const itemProportion = totalBrandBudget > 0 ? presupuestoAsignado / totalBrandBudget : 0;
        const ajusteMarca = totalBrandAdjustment * itemProportion;

        data.push({
          vendedor: cliente.vendedor,
          cliente: cliente.cliente,
          empresa: cliente.empresa,
          marca: marca.marca,
          presupuestoAsignado,
          ventasReales: cliente.articulos.reduce((sum, art) => sum + art.ventaReal, 0),
          ventaMesAnterior: previousMonthSales[key] || 0,
          ajusteManual: manualAdjustments[key] || 0,
          ajusteMarca,
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

  const handleBrandAdjustment = (marca: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setBrandAdjustments((prev) => {
      const newAdjustments = {
        ...prev,
        [marca]: numValue,
      };
      if (onBrandAdjustmentsChange) {
        onBrandAdjustmentsChange(newAdjustments);
      }
      return newAdjustments;
    });
  };

  const applyAdjustments = async () => {
    calculateVendorClientData();
    
    // Save brand adjustments to database
    try {
      const updates = marcasPresupuesto.map(mp => ({
        user_id: userId,
        marca: mp.marca,
        empresa: mp.empresa,
        presupuesto: mp.presupuesto,
        fecha_destino: mp.fechaDestino,
        vendor_adjustments: { brandAdjustments },
        role: (userRole as "administrador" | "gerente" | "admin_ventas") || 'administrador',
      }));

      // First delete existing entries for these brands
      const marcasToUpdate = [...new Set(updates.map(u => u.marca))];
      await supabase
        .from('budgets')
        .delete()
        .eq('user_id', userId)
        .in('marca', marcasToUpdate);

      // Then insert new values
      const { error } = await supabase.from('budgets').insert(updates);

      if (error) throw error;
      toast.success("Ajustes guardados exitosamente");
    } catch (error) {
      console.error("Error saving brand adjustments:", error);
      toast.error("Error al guardar ajustes");
    }
  };

  const exportToExcel = () => {
    const exportData = vendorClientData.map((item) => ({
      Vendedor: item.vendedor,
      Cliente: item.cliente,
      Empresa: item.empresa,
      Marca: item.marca,
      'Presupuesto Base': item.presupuestoAsignado,
      'Venta Mes Anterior': item.ventaMesAnterior,
      'Ventas Reales': item.ventasReales,
      'Ajuste Manual': item.ajusteManual,
      'Ajuste Marca': item.ajusteMarca,
      'Total': item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendedores-Clientes');
    XLSX.writeFile(workbook, `Reporte_Vendedores_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Reporte exportado exitosamente");
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
    acc[item.vendedor] = current + item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca;
    return acc;
  }, {} as Record<string, number>);

  const brandTotals = vendorClientData.reduce((acc, item) => {
    const current = acc[item.marca] || 0;
    acc[item.marca] = current + item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca;
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
          <Button onClick={exportToExcel} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
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
              <TableHead className="text-right">Venta Mes Anterior</TableHead>
              <TableHead className="text-right">Ventas Reales</TableHead>
              <TableHead className="text-right">Ajuste Manual</TableHead>
              <TableHead className="text-right">Ajuste Marca</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendorClientData.map((item, index) => {
              const key = `${item.vendedor}-${item.cliente}-${item.marca}`;
              const total = item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca;

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
                    ${item.ventaMesAnterior.toLocaleString("es-ES", {
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
                  <TableCell className="text-right">
                    ${item.ajusteMarca.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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

      {/* Brand Adjustments */}
      {!isReadOnly && (
        <div className="mt-6 space-y-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <DollarSign className="h-4 w-4" />
            <span>Ajustes por Marca (redistribuye proporcionalmente):</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(brandTotals).map((marca) => (
              <div key={marca} className="flex items-center gap-2">
                <Label className="text-xs font-medium min-w-[80px]">{marca}:</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={brandAdjustments[marca] || 0}
                  onChange={(e) => handleBrandAdjustment(marca, e.target.value)}
                  className="h-8 text-sm"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        </div>
      )}

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
