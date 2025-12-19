import { Card } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Crown } from "lucide-react";

interface MarcaResultado {
  marca: string;
  presupuesto: number;
  distribucionClientes: Array<{
    cliente: string;
    subtotal: number;
  }>;
}

interface BudgetKPICardsProps {
  resultadosFiltrados: MarcaResultado[];
  totalPresupuesto: number;
  vendedorFiltrado?: string | null; // Vendedor filtrado (si hay uno solo)
  totalPresupuestoGeneral?: number; // Total general sin filtros
}

export const BudgetKPICards = ({
  resultadosFiltrados,
  totalPresupuesto,
  vendedorFiltrado,
  totalPresupuestoGeneral,
}: BudgetKPICardsProps) => {
  // Marca con mayor inversión
  const marcaMayorInversion = resultadosFiltrados.reduce(
    (max, marca) => (marca.presupuesto > max.presupuesto ? marca : max),
    { marca: "-", presupuesto: 0 },
  );

  // Total de clientes únicos
  const clientesUnicos = new Set(resultadosFiltrados.flatMap((m) => m.distribucionClientes.map((c) => c.cliente)));

  // Promedio de presupuesto por cliente
  const promedioPresupuestoPorCliente =
    clientesUnicos.size > 0 ? resultadosFiltrados.reduce((sum, m) => sum + m.presupuesto, 0) / clientesUnicos.size : 0;

  // Total marcas
  const totalMarcas = resultadosFiltrados.length;

  const formatCurrency = (value: number) =>
    value.toLocaleString("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  // Calcular porcentaje del vendedor si está filtrado
  const porcentajeVendedor =
    vendedorFiltrado && totalPresupuestoGeneral && totalPresupuestoGeneral > 0
      ? (totalPresupuesto / totalPresupuestoGeneral) * 100
      : 0;

  // Si hay un vendedor filtrado, mostrar KPI de vendedor
  if (vendedorFiltrado) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden p-4 border-2 border-primary">
          <div className="absolute right-2 top-2 rounded-full bg-primary/10 p-2">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Vendedor Seleccionado</p>
          <p className="mt-1 truncate text-lg font-bold text-foreground">{vendedorFiltrado}</p>
          <p className="text-sm text-primary">filtro activo</p>
        </Card>

        <Card className="relative overflow-hidden p-4">
          <div className="absolute right-2 top-2 rounded-full bg-accent/10 p-2">
            <DollarSign className="h-4 w-4 text-accent" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Presupuesto Asignado</p>
          <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(totalPresupuesto)}</p>
          <p className="text-sm text-muted-foreground">total del vendedor</p>
        </Card>

        <Card className="relative overflow-hidden p-4">
          <div className="absolute right-2 top-2 rounded-full bg-primary/10 p-2">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">% del Presupuesto Total</p>
          <p className="mt-1 text-lg font-bold text-foreground">{porcentajeVendedor.toFixed(2)}%</p>
          <p className="text-sm text-muted-foreground">de {formatCurrency(totalPresupuestoGeneral || 0)}</p>
        </Card>

        <Card className="relative overflow-hidden p-4">
          <div className="absolute right-2 top-2 rounded-full bg-accent/10 p-2">
            <Crown className="h-4 w-4 text-accent" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Marcas Atendidas</p>
          <p className="mt-1 text-lg font-bold text-foreground">{totalMarcas}</p>
          <p className="text-sm text-muted-foreground">marcas activas</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="relative overflow-hidden p-4">
        <div className="absolute right-2 top-2 rounded-full bg-primary/10 p-2">
          <Crown className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Mayor Inversión</p>
        <p className="mt-1 truncate text-lg font-bold text-foreground">{marcaMayorInversion.marca}</p>
        <p className="text-sm text-primary">{formatCurrency(marcaMayorInversion.presupuesto)}</p>
      </Card>

      <Card className="relative overflow-hidden p-4">
        <div className="absolute right-2 top-2 rounded-full bg-accent/10 p-2">
          <Users className="h-4 w-4 text-accent" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Clientes Únicos</p>
        <p className="mt-1 text-lg font-bold text-foreground">{clientesUnicos.size}</p>
        <p className="text-sm text-muted-foreground">en {totalMarcas} marcas</p>
      </Card>

      <Card className="relative overflow-hidden p-4">
        <div className="absolute right-2 top-2 rounded-full bg-primary/10 p-2">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Promedio por Cliente</p>
        <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(promedioPresupuestoPorCliente)}</p>
        <p className="text-sm text-muted-foreground">distribución media</p>
      </Card>

      <Card className="relative overflow-hidden p-4">
        <div className="absolute right-2 top-2 rounded-full bg-accent/10 p-2">
          <DollarSign className="h-4 w-4 text-accent" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Total Acumulado</p>
        <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(totalPresupuesto)}</p>
        <p className="text-sm text-muted-foreground">presupuesto general</p>
      </Card>
    </div>
  );
};
