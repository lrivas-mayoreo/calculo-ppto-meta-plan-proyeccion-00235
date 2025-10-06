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
import type { CalculationResult } from "@/pages/Index";

interface BudgetResultsProps {
  result: CalculationResult;
}

export const BudgetResults = ({ result }: BudgetResultsProps) => {
  const totalDistribuido = result.distribucionClientes.reduce(
    (sum, dist) => sum + dist.totalCliente,
    0
  );

  return (
    <Card className="p-6 shadow-md">
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Distribución por Cliente</h2>
          <Badge variant="secondary" className="text-sm">
            {result.marca}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Mes destino: {result.mesDestino} | Venta total marca: $
          {result.ventaTotalMarcaMesDestino.toLocaleString("es-ES", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="text-sm font-medium text-primary">
          Factor aplicado: {result.factor.toFixed(6)} ({((result.factor - 1) * 100).toFixed(2)}%)
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Artículo</TableHead>
              <TableHead className="text-right">Venta Real</TableHead>
              <TableHead className="text-right">Venta Ajustada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.distribucionClientes.map((dist, idx) => (
              <>
                {dist.articulos.map((art, artIdx) => (
                  <TableRow key={`${idx}-${artIdx}`}>
                    {artIdx === 0 && (
                      <TableCell
                        rowSpan={dist.articulos.length}
                        className="font-semibold align-top"
                      >
                        {dist.cliente}
                      </TableCell>
                    )}
                    <TableCell>{art.articulo}</TableCell>
                    <TableCell className="text-right">
                      $
                      {art.ventaReal.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      $
                      {art.ventaAjustada.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-semibold">
                    Subtotal {dist.cliente}
                  </TableCell>
                  <TableCell colSpan={2} className="text-right font-semibold">
                    $
                    {dist.totalCliente.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              </>
            ))}
            <TableRow className="border-t-2 bg-muted/50 font-bold">
              <TableCell colSpan={3}>Total Distribuido</TableCell>
              <TableCell className="text-right text-accent">
                $
                {totalDistribuido.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Fórmula aplicada:</span> Venta
            ajustada = Venta real × Factor de marca
          </p>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Meses de referencia:</span>{" "}
            {result.mesesReferencia.join(", ")}
          </p>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Promedio ventas referencia:</span> $
            {result.promedioVentaMesesReferencia.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>
    </Card>
  );
};
