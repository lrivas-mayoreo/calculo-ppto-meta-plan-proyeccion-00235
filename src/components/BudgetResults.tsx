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
  const [filtroVendedor, setFiltroVendedor] = useState("all");
  const [filtroCliente, setFiltroCliente] = useState("all");
  const [filtroMarca, setFiltroMarca] = useState("all");
  const [filtroArticulo, setFiltroArticulo] = useState("all");
  const [filtroMes, setFiltroMes] = useState("all");

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

  const mesesUnicos = Array.from(
    new Set(result.resultadosMarcas.map((m) => m.mesDestino))
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
    .filter((marca) => filtroMes === "all" || marca.mesDestino === filtroMes)
    .map((marca) => ({
      ...marca,
      distribucionClientes: marca.distribucionClientes
        .filter((cliente) => filtroVendedor === "all" || cliente.vendedor === filtroVendedor)
        .filter((cliente) => filtroCliente === "all" || cliente.cliente === filtroCliente)
        .map((cliente) => ({
          ...cliente,
          articulos: cliente.articulos.filter(
            (articulo) => filtroArticulo === "all" || articulo.articulo === filtroArticulo
          ),
        }))
        .filter((cliente) => cliente.articulos.length > 0),
    }))
    .filter((marca) => marca.distribucionClientes.length > 0);

  const totalPresupuesto = result.totalPresupuesto;

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Filtros</h3>
        <div className="grid gap-4 md:grid-cols-5">
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
            <Label htmlFor="filtro-mes">Mes</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger id="filtro-mes">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {mesesUnicos.map((mes) => (
                  <SelectItem key={mes} value={mes}>
                    {mes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <div className="grid gap-3 md:grid-cols-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Marca</p>
                    <p className="font-semibold text-foreground">
                      {marcaResultado.marca}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mes Destino</p>
                    <p className="font-semibold text-foreground">
                      {marcaResultado.mesDestino}
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
                              colSpan={4}
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
