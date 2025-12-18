import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Search, TrendingUp, Users, DollarSign } from "lucide-react";
import { CalculationResult } from "../pages/Index";

interface VendorClientTableProps {
  result: CalculationResult;
  vendorAdjustments: Record<string, { value: number; type: "percentage" | "currency" }>;
  // ... otros props existentes
}

export const VendorClientTable = ({ result }: VendorClientTableProps) => {
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  // Filtrado lógico
  const filteredResults = useMemo(() => {
    return result.resultadosMarcas.filter(
      (res) =>
        res.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.distribucionClientes.some((c) => c.cliente.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [result, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 1. Buscador Rápido */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar marca o cliente..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 2. Resumen de KPIs de la Tabla */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <DollarSign className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Total Presupuesto</p>
            <p className="text-xl font-bold">${result.totalPresupuesto.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-blue-500/5 p-4 rounded-lg border border-blue-500/10 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-full">
            <Users className="text-blue-500 h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Marcas Activas</p>
            <p className="text-xl font-bold">{result.resultadosMarcas.length}</p>
          </div>
        </div>
        <div className="bg-green-500/5 p-4 rounded-lg border border-green-500/10 flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-full">
            <TrendingUp className="text-green-500 h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Crecimiento Promedio</p>
            <p className="text-xl font-bold">{result.resultadosMarcas[0]?.porcentajeCambio.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* 3. Tabla Jerárquica */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Marca / Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Venta Ref. Promedio</TableHead>
              <TableHead className="w-[200px]">Distribución Presupuesto</TableHead>
              <TableHead className="text-right font-bold">Presupuesto Sugerido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.map((res) => (
              <React.Fragment key={res.marca}>
                {/* Fila Padre: Marca */}
                <TableRow
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleBrand(res.marca)}
                >
                  <TableCell>
                    {expandedBrands[res.marca] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-primary">{res.marca}</TableCell>
                  <TableCell className="text-muted-foreground italic">Varios</TableCell>
                  <TableCell className="text-right">${res.promedioVentaMesesReferencia.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase font-medium">
                        <span>vs Real</span>
                        <span>
                          {res.porcentajeCambio > 0 ? "+" : ""}
                          {res.porcentajeCambio.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Math.min(res.porcentajeCambio + 50, 100)} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">${res.presupuesto.toLocaleString()}</TableCell>
                </TableRow>

                {/* Filas Hijas: Clientes (solo si está expandido) */}
                {expandedBrands[res.marca] &&
                  res.distribucionClientes.map((cli, idx) => (
                    <TableRow
                      key={`${res.marca}-${cli.cliente}-${idx}`}
                      className="bg-muted/10 border-l-4 border-l-primary/30"
                    >
                      <TableCell></TableCell>
                      <TableCell className="pl-8 text-sm">
                        <span className="text-muted-foreground mr-2">↳</span>
                        {cli.cliente}
                      </TableCell>
                      <TableCell className="text-sm">{cli.vendedor}</TableCell>
                      <TableCell className="text-right text-sm">
                        ${cli.articulos.reduce((sum, a) => sum + a.ventaReal, 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {/* Mini barra de participación del cliente en la marca */}
                        <Progress value={(cli.subtotal / res.presupuesto) * 100} className="h-1 bg-primary/10" />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">${cli.subtotal.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
