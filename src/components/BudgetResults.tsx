import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalculationResult } from "@/pages/Index";
import { useState } from "react";
import { BudgetKPICards } from "./BudgetKPICards";
import { BudgetAccordionTable } from "./BudgetAccordionTable";

interface BudgetResultsProps {
  result: CalculationResult;
}

export const BudgetResults = ({ result }: BudgetResultsProps) => {
  if (!result) return null;

  const [filtroVendedor, setFiltroVendedor] = useState("all");
  const [filtroCliente, setFiltroCliente] = useState("all");
  const [filtroMarca, setFiltroMarca] = useState("all");
  const [filtroArticulo, setFiltroArticulo] = useState("all");
  const [filtroFecha, setFiltroFecha] = useState("all");
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");

  // Obtener valores únicos para los filtros
  const vendedoresUnicos = Array.from(
    new Set(result.resultadosMarcas.flatMap((m) => m.distribucionClientes.map((c) => c.vendedor))),
  );

  const clientesUnicos = Array.from(
    new Set(result.resultadosMarcas.flatMap((m) => m.distribucionClientes.map((c) => c.cliente))),
  );

  const marcasUnicas = Array.from(new Set(result.resultadosMarcas.map((m) => m.marca)));

  const fechasUnicas = Array.from(new Set(result.resultadosMarcas.map((m) => m.fechaDestino)));

  const empresasUnicas = Array.from(new Set(result.resultadosMarcas.map((m) => m.empresa)));

  const articulosUnicos = Array.from(
    new Set(
      result.resultadosMarcas.flatMap((m) => m.distribucionClientes.flatMap((c) => c.articulos.map((a) => a.articulo))),
    ),
  );

  // Aplicar filtros
  const resultadosFiltrados = result.resultadosMarcas
    .filter((marca) => filtroMarca === "all" || marca.marca === filtroMarca)
    .filter((marca) => filtroFecha === "all" || marca.fechaDestino === filtroFecha)
    .filter((marca) => filtroEmpresa === "all" || marca.empresa === filtroEmpresa)
    .map((marca) => ({
      ...marca,
      distribucionClientes: marca.distribucionClientes
        .filter((cliente) => filtroVendedor === "all" || cliente.vendedor === filtroVendedor)
        .filter((cliente) => filtroCliente === "all" || cliente.cliente === filtroCliente)
        .filter((cliente) => filtroEmpresa === "all" || cliente.empresa === filtroEmpresa)
        .map((cliente) => ({
          ...cliente,
          articulos: cliente.articulos.filter(
            (articulo) => filtroArticulo === "all" || articulo.articulo === filtroArticulo,
          ),
        }))
        .filter((cliente) => cliente.articulos.length > 0),
    }))
    .filter((marca) => marca.distribucionClientes.length > 0);

  const totalPresupuesto = result.totalPresupuesto;

  // Calcular total filtrado real (no el presupuesto general)
  const totalFiltrado = resultadosFiltrados.reduce((sum, marca) => {
    return sum + marca.distribucionClientes.reduce((clientSum, cliente) => clientSum + cliente.subtotal, 0);
  }, 0);

  // Solo mostrar KPI de vendedor si hay exactamente 1 vendedor seleccionado
  const vendedorUnico = filtroVendedor !== "all" ? filtroVendedor : null;

  return (
    <div className="space-y-6">
      {/* KPI Cards - solo mostrar KPI de vendedor si hay 1 seleccionado */}
      <BudgetKPICards
        resultadosFiltrados={resultadosFiltrados}
        totalPresupuesto={totalFiltrado}
        vendedorFiltrado={vendedorUnico}
        totalPresupuestoGeneral={result.totalPresupuesto}
      />

      {/* Filtros */}
      <Card className="p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Filtros</h3>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="filtro-vendedor">Vendedor</Label>
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger id="filtro-vendedor">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vendedoresUnicos.map((vendedor) => (
                  <SelectItem key={vendedor} value={vendedor}>
                    {vendedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-cliente">Cliente</Label>
            <Select value={filtroCliente} onValueChange={setFiltroCliente}>
              <SelectTrigger id="filtro-cliente">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clientesUnicos.map((cliente) => (
                  <SelectItem key={cliente} value={cliente}>
                    {cliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-marca">Marca</Label>
            <Select value={filtroMarca} onValueChange={setFiltroMarca}>
              <SelectTrigger id="filtro-marca">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {marcasUnicas.map((marca) => (
                  <SelectItem key={marca} value={marca}>
                    {marca}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-articulo">Artículo</Label>
            <Select value={filtroArticulo} onValueChange={setFiltroArticulo}>
              <SelectTrigger id="filtro-articulo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {articulosUnicos.map((articulo) => (
                  <SelectItem key={articulo} value={articulo}>
                    {articulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-fecha">Fecha</Label>
            <Select value={filtroFecha} onValueChange={setFiltroFecha}>
              <SelectTrigger id="filtro-fecha">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {fechasUnicas.map((fecha) => (
                  <SelectItem key={fecha} value={fecha}>
                    {fecha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-empresa">Empresa</Label>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger id="filtro-empresa">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresasUnicas.map((empresa) => (
                  <SelectItem key={empresa} value={empresa}>
                    {empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabla Acordeón */}
      <BudgetAccordionTable resultadosFiltrados={resultadosFiltrados} totalPresupuesto={totalPresupuesto} />
    </div>
  );
};
