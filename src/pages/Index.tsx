import { useState } from "react";
import { Card } from "@/components/ui/card";
import { BudgetForm } from "@/components/BudgetForm";
import { BudgetResults } from "@/components/BudgetResults";
import { MetricsCard } from "@/components/MetricsCard";
import { Calculator, TrendingUp, Calendar, Users } from "lucide-react";

// Datos de ejemplo simulados - Ventas por marca, cliente, artículo y mes-año
const MOCK_DATA = {
  marcas: ["Nike", "Adidas", "Puma", "Reebok"],
  clientes: ["Cliente A", "Cliente B", "Cliente C", "Cliente D", "Cliente E"],
  articulos: {
    Nike: ["Air Max", "React", "Zoom", "Free"],
    Adidas: ["Ultraboost", "NMD", "Superstar", "Stan Smith"],
    Puma: ["Suede", "RS-X", "Thunder", "Cali"],
    Reebok: ["Classic", "Nano", "Club C", "Zig Kinetica"],
  },
  // Ventas por marca -> cliente -> artículo -> mes-año
  ventas: {} as Record<string, Record<string, Record<string, Record<string, number>>>>,
};

// Generar ventas simuladas con meses-año (últimos 24 meses)
const generarMesesAnio = () => {
  const meses = [];
  const ahora = new Date();
  for (let i = 23; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    meses.push(`${mes}-${anio}`);
  }
  return meses;
};

const mesesDisponibles = generarMesesAnio();

Object.keys(MOCK_DATA.articulos).forEach((marca) => {
  MOCK_DATA.ventas[marca] = {};
  MOCK_DATA.clientes.forEach((cliente) => {
    MOCK_DATA.ventas[marca][cliente] = {};
    MOCK_DATA.articulos[marca as keyof typeof MOCK_DATA.articulos].forEach((articulo) => {
      MOCK_DATA.ventas[marca][cliente][articulo] = {};
      mesesDisponibles.forEach((mesAnio) => {
        MOCK_DATA.ventas[marca][cliente][articulo][mesAnio] = 
          Math.floor(Math.random() * 15000) + 5000;
      });
    });
  });
});

export interface MarcaPresupuesto {
  marca: string;
  presupuesto: number;
}

export interface CalculationResult {
  mesDestino: string;
  mesesReferencia: string[];
  resultadosMarcas: {
    marca: string;
    presupuesto: number;
    ventaTotalMarcaMesDestino: number;
    factor: number;
    promedioVentaMesesReferencia: number;
    porcentajeCambio: number;
    distribucionClientes: {
      cliente: string;
      articulos: {
        articulo: string;
        ventaReal: number;
        ventaAjustada: number;
      }[];
      totalCliente: number;
    }[];
  }[];
}

const Index = () => {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [marcasPresupuesto, setMarcasPresupuesto] = useState<MarcaPresupuesto[]>([]);

  const handleCalculate = (
    mesDestino: string,
    marcasPresupuesto: MarcaPresupuesto[],
    mesesReferencia: string[]
  ) => {
    const resultadosMarcas = marcasPresupuesto.map((marcaPresupuesto) => {
      const { marca, presupuesto } = marcaPresupuesto;

      // Validación Error 1: Marca no existe en maestro
      if (!MOCK_DATA.marcas.includes(marca)) {
        throw new Error(`Error 1: La marca "${marca}" no existe en el maestro de marcas`);
      }

      // Calcular venta total de la marca en el mes destino
      let ventaTotalMarcaMesDestino = 0;
      MOCK_DATA.clientes.forEach((cliente) => {
        MOCK_DATA.articulos[marca as keyof typeof MOCK_DATA.articulos]?.forEach((articulo) => {
          const venta = MOCK_DATA.ventas[marca]?.[cliente]?.[articulo]?.[mesDestino] || 0;
          ventaTotalMarcaMesDestino += venta;
        });
      });

      // Validación Error 4: Marca sin ventas
      if (ventaTotalMarcaMesDestino === 0) {
        throw new Error(`Error 4: La marca "${marca}" no tiene ventas en el mes destino ${mesDestino}`);
      }

      // Calcular factor por marca
      const factor = presupuesto / ventaTotalMarcaMesDestino;

      // Calcular promedio de ventas en meses de referencia
      let totalVentasMesesReferencia = 0;
      let contadorMeses = 0;

      mesesReferencia.forEach((mesAnio) => {
        let ventaTotalMes = 0;
        MOCK_DATA.clientes.forEach((cliente) => {
          MOCK_DATA.articulos[marca as keyof typeof MOCK_DATA.articulos]?.forEach((articulo) => {
            const venta = MOCK_DATA.ventas[marca]?.[cliente]?.[articulo]?.[mesAnio] || 0;
            ventaTotalMes += venta;
          });
        });
        if (ventaTotalMes > 0) {
          totalVentasMesesReferencia += ventaTotalMes;
          contadorMeses++;
        }
      });

      const promedioVentaMesesReferencia = contadorMeses > 0 
        ? totalVentasMesesReferencia / contadorMeses 
        : 0;

      // Calcular porcentaje de cambio
      const porcentajeCambio = ((presupuesto - promedioVentaMesesReferencia) / promedioVentaMesesReferencia) * 100;

      // Distribución por cliente
      const distribucionClientes = MOCK_DATA.clientes.map((cliente) => {
        const articulos = MOCK_DATA.articulos[marca as keyof typeof MOCK_DATA.articulos]?.map((articulo) => {
          const ventaReal = MOCK_DATA.ventas[marca]?.[cliente]?.[articulo]?.[mesDestino] || 0;
          const ventaAjustada = ventaReal * factor;
          return {
            articulo,
            ventaReal,
            ventaAjustada,
          };
        }) || [];

        const totalCliente = articulos.reduce((sum, art) => sum + art.ventaAjustada, 0);

        return {
          cliente,
          articulos,
          totalCliente,
        };
      }).filter(dist => dist.totalCliente > 0);

      return {
        marca,
        presupuesto,
        ventaTotalMarcaMesDestino,
        factor,
        promedioVentaMesesReferencia,
        porcentajeCambio,
        distribucionClientes,
      };
    });

    setResult({
      mesDestino,
      mesesReferencia,
      resultadosMarcas,
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
              <BudgetForm 
                onCalculate={handleCalculate} 
                mockData={MOCK_DATA} 
                mesesDisponibles={mesesDisponibles}
                onMarcasPresupuestoLoad={setMarcasPresupuesto}
              />
            </Card>
          </div>

          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricsCard
                    title="Presupuesto Total"
                    value={`$${result.resultadosMarcas
                      .reduce((sum, m) => sum + m.presupuesto, 0)
                      .toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    icon={TrendingUp}
                    trend="neutral"
                  />
                  <MetricsCard
                    title="Marcas Calculadas"
                    value={result.resultadosMarcas.length.toString()}
                    icon={Calculator}
                    trend="positive"
                    subtitle="Con presupuesto"
                  />
                  <MetricsCard
                    title="Promedio General"
                    value={`$${(
                      result.resultadosMarcas.reduce(
                        (sum, m) => sum + m.promedioVentaMesesReferencia,
                        0
                      ) / result.resultadosMarcas.length
                    ).toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    icon={Calendar}
                    trend="neutral"
                    subtitle={`${result.mesesReferencia.length} meses ref.`}
                  />
                  <MetricsCard
                    title="Total Clientes"
                    value={result.resultadosMarcas
                      .reduce((sum, m) => sum + m.distribucionClientes.length, 0)
                      .toString()}
                    icon={Users}
                    trend="positive"
                    subtitle="Con distribución"
                  />
                </div>

                <BudgetResults result={result} />
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
