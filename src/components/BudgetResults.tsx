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
  marca: string;
  articulo: string;
}

const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const BudgetResults = ({ result, marca, articulo }: BudgetResultsProps) => {
  return (
    <Card className="p-6 shadow-md">
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Resultados del Análisis</h2>
          <Badge variant="secondary" className="text-sm">
            {marca} - {articulo}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Mes destino: {MESES_NOMBRES[result.mesDestino - 1]} | Venta real:{" "}
          $
          {result.ventaRealDestino.toLocaleString("es-ES", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              <TableHead className="text-right">Venta Real</TableHead>
              <TableHead className="text-right">Venta Ajustada</TableHead>
              <TableHead className="text-right">Contribución</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.mesesSeleccionados.map((mes, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{MESES_NOMBRES[mes.mes - 1]}</TableCell>
                <TableCell className="text-right">
                  $
                  {mes.ventaReal.toLocaleString("es-ES", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="text-right font-medium text-primary">
                  $
                  {mes.ventaAjustada.toLocaleString("es-ES", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  $
                  {(mes.ventaAjustada / result.mesesSeleccionados.length).toLocaleString(
                    "es-ES",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/50 font-semibold">
              <TableCell colSpan={2}>Total / Promedio</TableCell>
              <TableCell className="text-right">
                $
                {result.mesesSeleccionados
                  .reduce((sum, m) => sum + m.ventaAjustada, 0)
                  .toLocaleString("es-ES", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </TableCell>
              <TableCell className="text-right text-accent">
                $
                {result.promedioPonderado.toLocaleString("es-ES", {
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
            <span className="font-semibold text-foreground">Fórmula aplicada:</span> Promedio
            ponderado = Σ(Venta real × Factor) / N° meses con data
          </p>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Meses analizados:</span>{" "}
            {result.mesesSeleccionados.length} de los seleccionados
          </p>
        </div>
      </div>
    </Card>
  );
};
