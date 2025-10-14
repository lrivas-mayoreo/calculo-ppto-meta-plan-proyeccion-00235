import { Card } from "@/components/ui/card";
import { Calculator } from "lucide-react";

export const FormulaExplanation = () => {
  return (
    <Card className="p-6 mt-8">
      <div className="flex items-center gap-3 mb-4">
        <Calculator className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Fórmula de Cálculo del Presupuesto</h3>
      </div>
      
      <div className="space-y-4 text-sm text-muted-foreground">
        <div>
          <h4 className="font-medium text-foreground mb-2">1. Cálculo del Promedio de Ventas</h4>
          <p className="font-mono bg-muted p-2 rounded">
            Promedio = Σ(Ventas en Meses de Referencia) / Cantidad de Meses de Referencia
          </p>
        </div>

        <div>
          <h4 className="font-medium text-foreground mb-2">2. Factor de Ajuste</h4>
          <p className="font-mono bg-muted p-2 rounded">
            Factor = Presupuesto Objetivo / Promedio de Ventas
          </p>
        </div>

        <div>
          <h4 className="font-medium text-foreground mb-2">3. Distribución por Artículo</h4>
          <p className="font-mono bg-muted p-2 rounded">
            Venta Ajustada = Venta Promedio del Artículo × Factor
          </p>
        </div>

        <div>
          <h4 className="font-medium text-foreground mb-2">4. Porcentaje de Cambio</h4>
          <p className="font-mono bg-muted p-2 rounded">
            % Cambio = (Factor - 1) × 100
          </p>
        </div>

        <div className="pt-4 border-t">
          <p className="italic">
            <strong>Nota:</strong> El sistema distribuye el presupuesto proporcionalmente basándose en 
            el historial de ventas de cada artículo, cliente y vendedor en los meses de referencia seleccionados.
            Los ajustes de vendedores permiten redistribuir manualmente los porcentajes entre vendedores.
          </p>
        </div>
      </div>
    </Card>
  );
};
