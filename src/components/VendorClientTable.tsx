import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Search, TrendingUp, Target, Wallet, Users, Download } from "lucide-react";
import type { CalculationResult } from "@/pages/Index";
import * as XLSX from "xlsx";

interface VendorClientTableProps {
  result: CalculationResult;
  vendorAdjustments: Record<string, { value: number; type: "percentage" | "currency" }>;
  presupuestoTotal: number;
  userRole: string | null;
}

// Mini componente para Sparkline manual con Tailwind (evita instalar Recharts)
const MiniSparkline = () => (
  <div className="flex items-end gap-[2px] h-6">
    {[40, 70, 45, 90, 65, 80].map((h, i) => (
      <div key={i} className="w-1 bg-primary/40 rounded-t-sm" style={{ height: `${h}%` }} />
    ))}
  </div>
);

export const VendorClientTable = ({ result, presupuestoTotal, userRole }: VendorClientTableProps) => {
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  // Filtrado reactivo
  const filteredBrands = useMemo(() => {
    return result.resultadosMarcas.filter((marca) => {
      const matchMarca = marca.marca.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCliente = marca.distribucionClientes.some((c) =>
        c.cliente.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      return matchMarca || matchCliente;
    });
  }, [result, searchTerm]);

  // Cálculos para KPIs
  const stats = useMemo(() => {
    const totalActual = result.resultadosMarcas.reduce((acc, m) => acc + m.presupuesto, 0);
    const topMarca = [...result.resultadosMarcas].sort((a, b) => b.presupuesto - a.presupuesto)[0];
    const totalClientes = result.resultadosMarcas.reduce((acc, m) => acc + m.distribucionClientes.length, 0);

    return {
      total: totalActual,
      topMarca: topMarca?.marca || "N/A",
      avgCliente: totalActual / (totalClientes || 1),
      countMarcas: result.resultadosMarcas.length,
    };
  }, [result]);

  const getProgressColor = (percent: number) => {
    if (percent > 90) return "bg-red-500";
    if (percent > 75) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const exportToExcel = () => {
    const dataToExport = result.resultadosMarcas.flatMap((m) =>
      m.distribucionClientes.map((c) => ({
        Marca: m.marca,
        Cliente: c.cliente,
        Vendedor: c.vendedor,
        Presupuesto: c.subtotal,
      })),
    );
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
    XLSX.writeFile(wb, "Distribucion_Presupuesto.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* 4. Tarjetas de Resumen (KPI Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="pt-4 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total General</p>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold">${stats.total.toLocaleString("es-ES")}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardContent className="pt-4 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Marca Líder</p>
              <Target className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold truncate">{stats.topMarca}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="pt-4 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Promedio Cliente</p>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold">
              ${stats.avgCliente.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="pt-4 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Marcas Activas</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold">{stats.countMarcas}</p>
          </CardContent>
        </Card>
      </div>

      {/* 5. Filtro de Búsqueda Rápida y Acciones */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca o cliente..."
            className="pl-10 bg-white shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={exportToExcel} variant="outline" className="w-full md:w-auto">
          <Download className="h-4 w-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      {/* 1. Tabla Colapsable */}
      <div className="rounded-xl border bg-card shadow-md overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="font-bold">Distribución por Marca</TableHead>
              <TableHead className="hidden md:table-cell text-center">Tendencia</TableHead>
              <TableHead className="text-right font-bold">Presupuesto Sugerido</TableHead>
              <TableHead className="w-[180px]">% de Participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBrands.map((marca) => {
              const brandPercent = (marca.presupuesto / (stats.total || 1)) * 100;
              const isExpanded = expandedBrands[marca.marca];

              return (
                <React.Fragment key={marca.marca}>
                  {/* Fila Padre (Marca) */}
                  <TableRow
                    className="cursor-pointer hover:bg-primary/5 transition-colors group"
                    onClick={() => toggleBrand(marca.marca)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-primary transition-transform" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-800 tracking-tight">{marca.marca}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex justify-center">
                        <MiniSparkline />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      ${marca.presupuesto.toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                          <span>Mix</span>
                          <span>{brandPercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${getProgressColor(brandPercent)}`}
                            style={{ width: `${brandPercent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Filas Hijas (Clientes) */}
                  {isExpanded &&
                    marca.distribucionClientes.map((cliente, idx) => (
                      <TableRow
                        key={`${marca.marca}-${idx}`}
                        className="bg-slate-50/50 border-l-4 border-l-primary/30 animate-in slide-in-from-left-1 duration-200"
                      >
                        <TableCell></TableCell>
                        <TableCell className="pl-6 py-2">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="text-primary/40">↳</span>
                            {cliente.cliente}
                            <span className="text-[10px] text-muted-foreground italic">({cliente.vendedor})</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"></TableCell>
                        <TableCell className="text-right text-sm font-semibold text-slate-700">
                          ${cliente.subtotal.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 pr-2">
                            <Progress
                              value={(cliente.subtotal / (marca.presupuesto || 1)) * 100}
                              className="h-1 bg-slate-200"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
