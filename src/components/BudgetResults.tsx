import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { CalculationResult } from "@/pages/Index";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    new Set(
      result.resultadosMarcas.flatMap((m) =>
        m.distribucionClientes.map((c) => c.vendedor)
      )
    )
  );

  const clientesUnicos = Array.from(
    new Set(
      result.resultadosMarcas.flatMap((m) =>
        m.distribucionClientes.map((c) => c.cliente)
      )
    )
  );

  const marcasUnicas = Array.from(
    new Set(result.resultadosMarcas.map((m) => m.marca))
  );

  const fechasUnicas = Array.from(
    new Set(result.resultadosMarcas.map((m) => m.fechaDestino))
  );

  const empresasUnicas = Array.from(
    new Set(result.resultadosMarcas.map((m) => m.empresa))
  );

  const articulosUnicos = Array.from(
    new Set(
      result.resultadosMarcas.flatMap((m) =>
        m.distribucionClientes.flatMap((c) =>
          c.articulos.map((a) => a.articulo)
        )
      )
    )
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
            (articulo) => filtroArticulo === "all" || articulo.articulo === filtroArticulo
          ),
        }))
        .filter((cliente) => cliente.articulos.length > 0),
    }))
    .filter((marca) => marca.distribucionClientes.length > 0);

  // Calcular totales filtrados
  const totalPresupuestoFiltrado = resultadosFiltrados.reduce(
    (sum, marca) => sum + marca.presupuesto,
    0
  );

  const totalPromedioReferenciaFiltrado = resultadosFiltrados.length > 0
    ? resultadosFiltrados.reduce((sum, marca) => sum + marca.promedioVentaMesesReferencia, 0) / resultadosFiltrados.length
    : 0;

  const totalPresupuesto = result.totalPresupuesto;

  return (
    <div className="space-y-6">
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

        {/* Totales Filtrados */}
        <div className="mt-4 grid gap-3 rounded-lg bg-muted/50 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Presupuesto Filtrado</p>
            <p className="text-lg font-semibold text-foreground">
              ${totalPresupuestoFiltrado.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Promedio Ref. Filtrado</p>
            <p className="text-lg font-semibold text-foreground">
              ${totalPromedioReferenciaFiltrado.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Marcas Filtradas</p>
            <p className="text-lg font-semibold text-foreground">
              {resultadosFiltrados.length}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-md">
        <h2 className="mb-4 text-xl font-bold text-foreground">
          Distribución de Presupuesto por Marca
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Total Presupuesto:{" "}
          <span className="font-semibold text-foreground">
            $
            {totalPresupuesto.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>

        <div className="space-y-8">
          {resultadosFiltrados.map((marcaResultado, index) => (
            <div key={index}>
              <div className="mb-4 rounded-lg bg-muted/50 p-4">
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Marca</p>
                    <p className="font-semibold text-foreground">
                      {marcaResultado.marca}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha Destino</p>
                    <p className="font-semibold text-foreground">
                      {marcaResultado.fechaDestino}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="font-semibold text-foreground">
                      {marcaResultado.empresa}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Presupuesto Asignado
                    </p>
                    <p className="font-semibold text-foreground">
                      $
                      {marcaResultado.presupuesto.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Promedio Ref.
                    </p>
                    <p className="font-semibold text-foreground">
                      $
                      {marcaResultado.promedioVentaMesesReferencia.toLocaleString(
                        "es-ES",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      % de Cambio
                    </p>
                    <p
                      className={`flex items-center gap-1 font-semibold ${
                        marcaResultado.porcentajeCambio >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {marcaResultado.porcentajeCambio >= 0 ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      {Math.abs(marcaResultado.porcentajeCambio).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Artículo</TableHead>
                      <TableHead className="text-right">Venta Real</TableHead>
                      <TableHead className="text-right">
                        Venta Ajustada
                      </TableHead>
                      <TableHead className="text-right">Variación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marcaResultado.distribucionClientes.map(
                      (cliente, clienteIdx) => (
                        <>
                          {cliente.articulos.map((articulo, articuloIdx) => (
                            <TableRow key={`${clienteIdx}-${articuloIdx}`}>
                              {articuloIdx === 0 && (
                                <>
                                  <TableCell
                                    rowSpan={cliente.articulos.length}
                                    className="font-medium"
                                  >
                                    {cliente.cliente}
                                  </TableCell>
                                  <TableCell
                                    rowSpan={cliente.articulos.length}
                                  >
                                    {cliente.vendedor}
                                  </TableCell>
                                  <TableCell
                                    rowSpan={cliente.articulos.length}
                                  >
                                    {cliente.empresa}
                                  </TableCell>
                                </>
                              )}
                              <TableCell>{articulo.articulo}</TableCell>
                              <TableCell className="text-right">
                                $
                                {articulo.ventaReal.toLocaleString("es-ES", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                $
                                {articulo.ventaAjustada.toLocaleString(
                                  "es-ES",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-right ${
                                  articulo.variacion >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {articulo.variacion >= 0 ? "+" : ""}
                                {articulo.variacion.toLocaleString("es-ES", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30">
                            <TableCell
                              colSpan={5}
                              className="text-right font-semibold"
                            >
                              Subtotal {cliente.cliente}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              $
                              {cliente.subtotal.toLocaleString("es-ES", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>

              {index < resultadosFiltrados.length - 1 && (
                <Separator className="my-6" />
              )}
            </div>
          ))}

          {resultadosFiltrados.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No se encontraron resultados con los filtros aplicados
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
