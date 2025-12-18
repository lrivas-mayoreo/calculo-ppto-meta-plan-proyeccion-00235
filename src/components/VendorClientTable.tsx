import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Users, DollarSign, Download, ChevronDown, ChevronRight, Search, TrendingUp, Building2 } from "lucide-react";
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

export const VendorClientTable = ({
  result,
  vendorAdjustments,
  presupuestoTotal,
  userRole,
  marcasPresupuesto,
  userId,
  onBrandAdjustmentsChange,
}: VendorClientTableProps) => {
  const [vendorClientData, setVendorClientData] = useState<VendorClientData[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
  const [brandAdjustments, setBrandAdjustments] = useState<Record<string, number>>({});
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [previousMonthSales, setPreviousMonthSales] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPreviousMonthSales();
  }, [result]);

  useEffect(() => {
    calculateVendorClientData();
  }, [result, previousMonthSales, brandAdjustments, manualAdjustments]);

  const loadPreviousMonthSales = async () => {
    const salesByKey: Record<string, number> = {};
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase.from("user_roles").select("role_id").eq("user_id", user.id).maybeSingle();
    const userRoleId = roleData?.role_id;

    const [allowedMarcasRes, allowedClientesRes] = await Promise.all([
      supabase.from("marcas_per_role").select("marca_id").eq("role_id", userRoleId),
      supabase.from("clientes_per_role").select("cliente_id").eq("role_id", userRoleId),
    ]);

    const allowedMarcaIds = allowedMarcasRes.data?.map((m) => m.marca_id) || [];
    const allowedClienteIds = allowedClientesRes.data?.map((c) => c.cliente_id) || [];

    const [clientsRes, brandsRes] = await Promise.all([
      allowedClienteIds.length > 0
        ? supabase.from("clientes").select("nombre, codigo").in("id", allowedClienteIds)
        : { data: [] },
      allowedMarcaIds.length > 0
        ? supabase.from("marcas").select("nombre, codigo").in("id", allowedMarcaIds)
        : { data: [] },
    ]);

    const clientCodes = new Map(clientsRes.data?.map((c) => [c.nombre, c.codigo]));
    const brandCodes = new Map(brandsRes.data?.map((b) => [b.nombre, b.codigo]));

    for (const marca of result.resultadosMarcas) {
      const parts = marca.fechaDestino.split("/");
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      date.setMonth(date.getMonth() - 1);
      const previousMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;

      const codigoMarca = brandCodes.get(marca.marca);
      if (!codigoMarca) continue;

      for (const distribucion of marca.distribucionClientes) {
        const codigoCliente = clientCodes.get(distribucion.cliente);
        const key = `${distribucion.vendedor}-${distribucion.cliente}-${marca.marca}`;

        if (!codigoCliente) {
          salesByKey[key] = 0;
          continue;
        }

        const { data } = await supabase
          .from("ventas_reales")
          .select("monto")
          .eq("mes", previousMonth)
          .eq("codigo_marca", codigoMarca)
          .eq("codigo_cliente", codigoCliente);
        salesByKey[key] = data?.reduce((sum, sale) => sum + Number(sale.monto), 0) || 0;
      }
    }
    setPreviousMonthSales(salesByKey);
  };

  const calculateVendorClientData = () => {
    const data: VendorClientData[] = [];
    result.resultadosMarcas.forEach((marca) => {
      const totalBrandAdjustment = brandAdjustments[marca.marca] || 0;
      const totalBrandBudget = marca.distribucionClientes.reduce((sum, cliente) => sum + cliente.subtotal, 0);

      marca.distribucionClientes.forEach((cliente) => {
        const key = `${cliente.vendedor}-${cliente.cliente}-${marca.marca}`;
        const itemProportion = totalBrandBudget > 0 ? cliente.subtotal / totalBrandBudget : 0;
        data.push({
          vendedor: cliente.vendedor,
          cliente: cliente.cliente,
          empresa: cliente.empresa,
          marca: marca.marca,
          presupuestoAsignado: cliente.subtotal,
          ventasReales: cliente.articulos.reduce((sum, art) => sum + art.ventaReal, 0),
          ventaMesAnterior: previousMonthSales[key] || 0,
          ajusteManual: manualAdjustments[key] || 0,
          ajusteMarca: totalBrandAdjustment * itemProportion,
          key,
        });
      });
    });
    setVendorClientData(data);
  };

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  const filteredData = useMemo(() => {
    return vendorClientData.filter(
      (item) =>
        item.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendedor.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [vendorClientData, searchTerm]);

  // Agrupación por marca para la vista jerárquica
  const groupedData = useMemo(() => {
    const groups: Record<string, { total: number; real: number; items: VendorClientData[] }> = {};
    filteredData.forEach((item) => {
      if (!groups[item.marca]) groups[item.marca] = { total: 0, real: 0, items: [] };
      groups[item.marca].total += item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca;
      groups[item.marca].real += item.ventasReales;
      groups[item.marca].items.push(item);
    });
    return groups;
  }, [filteredData]);

  const vendorTotals = vendorClientData.reduce(
    (acc, item) => {
      acc[item.vendedor] = (acc[item.vendedor] || 0) + item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca;
      return acc;
    },
    {} as Record<string, number>,
  );

  const grandTotal = Object.values(vendorTotals).reduce((sum, val) => sum + val, 0);
  const isReadOnly = userRole === "gerente";

  return (
    <div className="space-y-6">
      {/* KPIs Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3 bg-primary/5 border-primary/10">
          <div className="p-2 bg-primary/10 rounded-full">
            <DollarSign className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Presupuestado</p>
            <p className="text-lg font-bold">${grandTotal.toLocaleString("es-ES")}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-full">
            <Building2 className="text-blue-500 h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Marcas en Pantalla</p>
            <p className="text-lg font-bold">{Object.keys(groupedData).length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-full">
            <TrendingUp className="text-green-500 h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Eficiencia Global</p>
            <p className="text-lg font-bold">
              {((grandTotal / (vendorClientData.reduce((s, i) => s + i.ventasReales, 0) || 1)) * 100 - 100).toFixed(1)}%
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-full">
            <Users className="text-orange-500 h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Vendedores</p>
            <p className="text-lg font-bold">{Object.keys(vendorTotals).length}</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por marca, cliente o vendedor..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={() => {
                const worksheet = XLSX.utils.json_to_sheet(vendorClientData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle");
                XLSX.writeFile(workbook, `Presupuesto_Detalle.xlsx`);
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
            {!isReadOnly && (
              <Button size="sm" className="flex-1" onClick={() => toast.success("Ajustes aplicados")}>
                Guardar Cambios
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Entidad (Marca / Cliente)</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Venta Real (Ref)</TableHead>
                <TableHead className="w-[150px]">Crecimiento</TableHead>
                <TableHead className="text-right font-bold">Presupuesto Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedData).map(([marca, data]) => (
                <React.Fragment key={marca}>
                  {/* FILA PADRE: MARCA */}
                  <TableRow
                    className="cursor-pointer hover:bg-primary/5 transition-colors font-semibold"
                    onClick={() => toggleBrand(marca)}
                  >
                    <TableCell>
                      {expandedBrands[marca] ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="text-primary">{marca}</TableCell>
                    <TableCell className="text-muted-foreground text-xs uppercase">Resumen Marca</TableCell>
                    <TableCell className="text-right">${data.real.toLocaleString("es-ES")}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={Math.min((data.total / (data.real || 1)) * 50, 100)} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-primary font-bold">
                      ${data.total.toLocaleString("es-ES")}
                    </TableCell>
                  </TableRow>

                  {/* FILAS HIJAS: CLIENTES */}
                  {expandedBrands[marca] &&
                    data.items.map((item) => (
                      <TableRow key={item.key} className="bg-muted/20 border-l-4 border-l-primary/40">
                        <TableCell></TableCell>
                        <TableCell className="pl-6 text-sm">
                          <span className="text-muted-foreground mr-2">↳</span>
                          {item.cliente}
                        </TableCell>
                        <TableCell className="text-sm">{item.vendedor}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          ${item.ventasReales.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border">
                            {((item.presupuestoAsignado / (item.ventasReales || 1)) * 100 - 100).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ${(item.presupuestoAsignado + item.ajusteManual + item.ajusteMarca).toLocaleString("es-ES")}
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totales por Vendedor al Final */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
          <div className="space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" /> Resumen por Vendedor
            </h4>
            <div className="space-y-2">
              {Object.entries(vendorTotals).map(([vendedor, total]) => (
                <div key={vendedor} className="flex justify-between items-center p-2 rounded bg-muted/30 text-sm">
                  <span>{vendedor}</span>
                  <span className="font-bold">${total.toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-primary text-primary-foreground p-6 rounded-xl flex flex-col justify-center items-end">
            <p className="text-primary-foreground/80 text-sm font-medium uppercase">Total Presupuesto General</p>
            <h2 className="text-4xl font-black">${grandTotal.toLocaleString("es-ES")}</h2>
          </div>
        </div>
      </Card>
    </div>
  );
};

import React from "react"; // Necesario para React.Fragment
