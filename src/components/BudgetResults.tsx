import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CalculationResult } from "@/pages/Index";

interface BudgetResultsProps {
  result: CalculationResult;
}

export const BudgetResults = ({ result }: BudgetResultsProps) => {
  const totalPresupuesto = result.resultadosMarcas.reduce(
    (sum, marca) => sum + marca.presupuesto,
    0
  );

  return (
    <Card className="overflow-hidden shadow-md">
      <div className="border-b border-border bg-muted/50 p-6">
        <h2 className="text-xl font-semibold text-foreground">
          Distribución de Presupuesto por Marca
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mes Destino: <span className="font-medium text-foreground">{result.mesDestino}</span> |
          Meses Referencia: <span className="font-medium text-foreground">{result.mesesReferencia.join(", ")}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Total Presupuesto:{" "}
          <span className="font-medium text-foreground">
            ${totalPresupuesto.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        {result.resultadosMarcas.map((marcaResult, marcaIdx) => (
          <div key={marcaIdx}>
            <div className="bg-primary/10 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">{marcaResult.marca}</h3>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Presupuesto: </span>
                    <span className="font-semibold">
                      ${marcaResult.presupuesto.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Promedio Ref: </span>
                    <span className="font-semibold">
                      ${marcaResult.promedioVentaMesesReferencia.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div>
                    <Badge variant={marcaResult.porcentajeCambio > 0 ? "default" : marcaResult.porcentajeCambio < 0 ? "destructive" : "secondary"}>
                      {marcaResult.porcentajeCambio >= 0 ? "+" : ""}
                      {marcaResult.porcentajeCambio.toFixed(2)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Artículo</TableHead>
                  <TableHead className="text-right font-semibold">Venta Real</TableHead>
                  <TableHead className="text-right font-semibold">Venta Ajustada</TableHead>
                  <TableHead className="text-right font-semibold">Variación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marcaResult.distribucionClientes.map((cliente, clienteIdx) => (
                  <>
                    {cliente.articulos.map((articulo, articuloIdx) => {
                      const variacion = articulo.ventaAjustada - articulo.ventaReal;
                      const variacionPorcentaje =
                        articulo.ventaReal > 0
                          ? ((variacion / articulo.ventaReal) * 100).toFixed(2)
                          : "0.00";

                      return (
                        <TableRow
                          key={`${clienteIdx}-${articuloIdx}`}
                          className="hover:bg-muted/50"
                        >
                          {articuloIdx === 0 && (
                            <TableCell
                              rowSpan={cliente.articulos.length}
                              className="border-r border-border bg-muted/20 font-medium"
                            >
                              {cliente.cliente}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground">
                            {articulo.articulo}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${articulo.ventaReal.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            ${articulo.ventaAjustada.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                variacion > 0 ? "default" : variacion < 0 ? "destructive" : "secondary"
                              }
                            >
                              {variacion >= 0 ? "+" : ""}
                              {variacionPorcentaje}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 border-primary/20 bg-primary/5">
                      <TableCell colSpan={2} className="text-right font-semibold">
                        Total {cliente.cliente}:
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        $
                        {cliente.articulos
                          .reduce((sum, art) => sum + art.ventaReal, 0)
                          .toLocaleString("es-ES", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${cliente.totalCliente.toLocaleString("es-ES", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>

            {marcaIdx < result.resultadosMarcas.length - 1 && (
              <Separator className="my-4" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
