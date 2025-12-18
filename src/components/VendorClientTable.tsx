import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Search, Target, Wallet, Users, Download, TrendingUp } from "lucide-react";
import type { CalculationResult } from "@/pages/Index";
import * as XLSX from "xlsx";

interface VendorClientTableProps {
  result: CalculationResult;
  vendorAdjustments: Record<string, { value: number; type: "percentage" | "currency" }>;
  presupuestoTotal: number;
  userRole: string | null;
  marcasPresupuesto: any[];
  userId: string;
  onBrandAdjustmentsChange: (adjustments: Record<string, number>) => void;
}

const MiniSparkline = () => (
  <div className="flex items-end gap-[2px] h-6 justify-center">
    {[40, 70, 45, 90, 65, 80].map((h, i) => (
      <div key={i} className="w-1 bg-primary/40 rounded-t-sm" style={{ height: `${h}%` }} />
    ))}
  </div>
);

export const VendorClientTable = ({
  result,
  presupuestoTotal,
  userRole,
  marcasPresupuesto,
  userId,
  onBrandAdjustmentsChange,
}: VendorClientTableProps) => {
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => ({
      ...prev,
      [brand]: !prev[brand],
    }));
  };

  const filteredBrands = useMemo(() => {
    return result.resultadosMarcas.filter((marca) => {
      const matchMarca = marca.marca.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCliente = marca.distribucionClientes.some((c) =>
        c.cliente.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      return matchMarca || matchCliente;
    });
  }, [result, searchTerm]);

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="pt-4 p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total General</p>
            <p className="text-xl font-bold">${stats.total.toLocaleString("es-ES")}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardContent className="pt-4 p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Marca Líder</p>
            <p className="text-xl font-bold truncate">{stats.topMarca}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="pt-4 p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Promedio Cliente</p>
            <p className="text-xl font-bold">
              ${stats.avgCliente.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="pt-4 p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Marcas</p>
            <p className="text-xl font-bold">{stats.countMarcas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filtrar por marca o cliente..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabla con lógica de Acordeón */}
      <div className="rounded-xl border bg-card shadow-md overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Marca / Cliente</TableHead>
              <TableHead className="text-center hidden md:table-cell">Tendencia</TableHead>
              <TableHead className="text-right">Presupuesto</TableHead>
              <TableHead className="w-[180px]">Participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBrands.map((marca) => {
              const brandPercent = (marca.presupuesto / (stats.total || 1)) * 100;
              const isExpanded = !!expandedBrands[marca.marca]; // Forzamos booleano

              return (
                <React.Fragment key={marca.marca}>
                  {/* FILA PADRE: Siempre visible */}
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50 transition-colors font-bold"
                    onClick={() => toggleBrand(marca.marca)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-primary" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-slate-800">{marca.marca}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <MiniSparkline />
                    </TableCell>
                    <TableCell className="text-right text-primary">
                      ${marca.presupuesto.toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">{brandPercent.toFixed(1)}%</span>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(brandPercent)}`}
                            style={{ width: `${brandPercent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* FILAS HIJAS: Solo se renderizan si isExpanded es true */}
                  {isExpanded &&
                    marca.distribucionClientes.map((cliente, idx) => (
                      <TableRow key={`${marca.marca}-${idx}`} className="bg-slate-50/50 border-l-4 border-l-primary/40">
                        <TableCell></TableCell>
                        <TableCell className="pl-6 text-sm text-slate-600 italic">
                          ↳ {cliente.cliente} <span className="text-[10px]">({cliente.vendedor})</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"></TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ${cliente.subtotal.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell>
                          <Progress value={(cliente.subtotal / marca.presupuesto) * 100} className="h-1" />
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
