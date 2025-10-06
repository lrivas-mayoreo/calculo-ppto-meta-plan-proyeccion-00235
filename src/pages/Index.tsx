import { useState } from "react";
import { Card } from "@/components/ui/card";
import { BudgetForm } from "@/components/BudgetForm";
import { BudgetResults } from "@/components/BudgetResults";
import { MetricsCard } from "@/components/MetricsCard";
import { Calculator, TrendingUp, Calendar } from "lucide-react";

// Datos de ejemplo simulados
const MOCK_DATA = {
  marcas: ["Nike", "Adidas", "Puma", "Reebok"],
  articulos: {
    Nike: ["Air Max", "React", "Zoom", "Free"],
    Adidas: ["Ultraboost", "NMD", "Superstar", "Stan Smith"],
    Puma: ["Suede", "RS-X", "Thunder", "Cali"],
    Reebok: ["Classic", "Nano", "Club C", "Zig Kinetica"],
  },
  ventas: {} as Record<string, Record<string, number[]>>,
};

// Generar ventas aleatorias para demo
Object.keys(MOCK_DATA.articulos).forEach((marca) => {
  MOCK_DATA.ventas[marca] = {};
  MOCK_DATA.articulos[marca as keyof typeof MOCK_DATA.articulos].forEach((articulo) => {
    MOCK_DATA.ventas[marca][articulo] = Array.from(
      { length: 12 },
      () => Math.floor(Math.random() * 20000) + 10000
    );
  });
});

export interface CalculationResult {
  mesDestino: number;
  ventaRealDestino: number;
  factor: number;
  mesesSeleccionados: {
    mes: number;
    ventaReal: number;
    ventaAjustada: number;
  }[];
  promedioPonderado: number;
  presupuesto: number;
}

const Index = () => {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [marca, setMarca] = useState("");
  const [articulo, setArticulo] = useState("");

  const handleCalculate = (
    selectedMarca: string,
    selectedArticulo: string,
    mesDestino: number,
    presupuesto: number,
    mesesReferencia: number[]
  ) => {
    setMarca(selectedMarca);
    setArticulo(selectedArticulo);

    const ventasArticulo = MOCK_DATA.ventas[selectedMarca]?.[selectedArticulo] || [];
    const ventaRealDestino = ventasArticulo[mesDestino - 1] || 0;
    const factor = ventaRealDestino > 0 ? presupuesto / ventaRealDestino : 0;

    const mesesConData = mesesReferencia.filter((mes) => {
      const venta = ventasArticulo[mes - 1];
      return venta !== undefined && venta > 0;
    });

    const mesesSeleccionados = mesesConData.map((mes) => {
      const ventaReal = ventasArticulo[mes - 1];
      const ventaAjustada = ventaReal * factor;
      return {
        mes,
        ventaReal,
        ventaAjustada,
      };
    });

    const sumaAjustada = mesesSeleccionados.reduce((sum, m) => sum + m.ventaAjustada, 0);
    const promedioPonderado = mesesConData.length > 0 ? sumaAjustada / mesesConData.length : 0;

    setResult({
      mesDestino,
      ventaRealDestino,
      factor,
      mesesSeleccionados,
      promedioPonderado,
      presupuesto,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2.5">
              <Calculator className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Sistema de Cálculo de Presupuestos
              </h1>
              <p className="text-sm text-muted-foreground">
                Análisis dinámico basado en datos históricos de ventas
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card className="p-6 shadow-md">
              <BudgetForm onCalculate={handleCalculate} mockData={MOCK_DATA} />
            </Card>
          </div>

          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricsCard
                    title="Presupuesto Total"
                    value={`$${result.presupuesto.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    icon={TrendingUp}
                    trend="neutral"
                  />
                  <MetricsCard
                    title="Factor de Ajuste"
                    value={`${((result.factor - 1) * 100).toFixed(2)}%`}
                    icon={Calculator}
                    trend={result.factor > 1 ? "positive" : result.factor < 1 ? "negative" : "neutral"}
                    subtitle={`Factor: ${result.factor.toFixed(6)}`}
                  />
                  <MetricsCard
                    title="Promedio Ponderado"
                    value={`$${result.promedioPonderado.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    icon={Calendar}
                    trend="positive"
                    subtitle={`${result.mesesSeleccionados.length} meses`}
                  />
                </div>

                <BudgetResults result={result} marca={marca} articulo={articulo} />
              </div>
            ) : (
              <Card className="flex h-[400px] items-center justify-center p-8 shadow-md">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="rounded-full bg-muted p-6">
                      <Calculator className="h-12 w-12 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    Sin cálculos realizados
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Complete el formulario para ver los resultados del análisis
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
