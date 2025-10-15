import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetForm } from "@/components/BudgetForm";
import { BudgetResults } from "@/components/BudgetResults";
import { MetricsCard } from "@/components/MetricsCard";
import { VendorAdjustment } from "@/components/VendorAdjustment";
import { VendorClientTable } from "@/components/VendorClientTable";
import { RoleManagement } from "@/components/RoleManagement";
import { FormulaExplanation } from "@/components/FormulaExplanation";
import { Calculator, TrendingUp, Calendar, Users, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

// Datos de ejemplo simulados - Ventas por marca, cliente, artículo, vendedor, empresa y mes-año
const MOCK_DATA = {
  marcas: ["Nike", "Adidas", "Puma", "Reebok", "New Balance"],
  clientes: ["Cliente A", "Cliente B", "Cliente C", "Cliente D"],
  vendedores: ["Vendedor 1", "Vendedor 2", "Vendedor 3"],
  empresas: ["Empresa Alpha", "Empresa Beta", "Empresa Gamma"],
  articulos: {
    Nike: ["Nike Air Max", "Nike React", "Nike Zoom"],
    Adidas: ["Adidas Ultraboost", "Adidas NMD", "Adidas Superstar"],
    Puma: ["Puma Suede", "Puma RS-X", "Puma Clyde"],
    Reebok: ["Reebok Classic", "Reebok Nano", "Reebok Zig"],
    "New Balance": ["New Balance 574", "New Balance 990", "New Balance 327"],
  } as Record<string, string[]>,
  ventas: [] as Array<{
    mesAnio: string;
    marca: string;
    cliente: string;
    articulo: string;
    vendedor: string;
    empresa: string;
    venta: number;
  }>,
};

const generarMesesAnio = () => {
  const meses = [];
  const hoy = new Date();
  for (let i = 0; i < 24; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const mes = fecha.toLocaleString("es-ES", { month: "long" });
    const anio = fecha.getFullYear();
    meses.push(`${mes}-${anio}`);
  }
  return meses;
};

const mesesDisponibles = generarMesesAnio();

// Generar datos de ventas para los últimos 24 meses (excepto New Balance que no tiene ventas)
mesesDisponibles.forEach((mesAnio) => {
  MOCK_DATA.marcas.forEach((marca) => {
    // New Balance no tiene ventas (para demostrar Error 3)
    if (marca === "New Balance") return;
    
    MOCK_DATA.clientes.forEach((cliente) => {
      MOCK_DATA.articulos[marca]?.forEach((articulo) => {
        const vendedor = MOCK_DATA.vendedores[Math.floor(Math.random() * MOCK_DATA.vendedores.length)];
        const empresa = MOCK_DATA.empresas[Math.floor(Math.random() * MOCK_DATA.empresas.length)];
        MOCK_DATA.ventas.push({
          mesAnio,
          marca,
          cliente,
          articulo,
          vendedor,
          empresa,
          venta: Math.random() * 10000 + 5000,
        });
      });
    });
  });
});

export interface MarcaPresupuesto {
  marca: string;
  fechaDestino: string;
  empresa: string;
  presupuesto: number;
}

export interface CalculationResult {
  totalPresupuesto: number;
  promedioVentaReferencia: number;
  resultadosMarcas: Array<{
    marca: string;
    fechaDestino: string;
    empresa: string;
    presupuesto: number;
    promedioVentaMesesReferencia: number;
    porcentajeCambio: number;
    distribucionClientes: Array<{
      cliente: string;
      vendedor: string;
      empresa: string;
      articulos: Array<{
        articulo: string;
        ventaReal: number;
        ventaAjustada: number;
        variacion: number;
      }>;
      subtotal: number;
    }>;
  }>;
  errores: Array<{
    tipo: number;
    marca: string;
    fechaDestino: string;
    empresa: string;
    mensaje: string;
  }>;
}

const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [marcasPresupuesto, setMarcasPresupuesto] = useState<MarcaPresupuesto[]>([]);
  const [vendorAdjustments, setVendorAdjustments] = useState<Record<string, { value: number; type: "percentage" | "currency" }>>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        // Load user role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        setUserRole(roleData?.role || null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        // Load user role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        setUserRole(roleData?.role || null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleCalculate = (
    marcasPresupuesto: MarcaPresupuesto[],
    mesesReferencia: string[]
  ) => {
    const resultadosMarcas: CalculationResult["resultadosMarcas"] = [];
    const errores: CalculationResult["errores"] = [];
    let totalPresupuestoGeneral = 0;
    let totalPromedioReferenciaGeneral = 0;

    marcasPresupuesto.forEach((marcaPresupuesto) => {
      const { marca, fechaDestino, empresa, presupuesto } = marcaPresupuesto;

      // Validación Error 1: Marca no existe
      if (!MOCK_DATA.marcas.includes(marca)) {
        errores.push({
          tipo: 1,
          marca,
          fechaDestino,
          empresa,
          mensaje: `La marca "${marca}" no existe en el maestro de marcas`,
        });
        return;
      }

      // Obtener ventas de los meses de referencia para esta marca y empresa
      const ventasMesesReferencia = MOCK_DATA.ventas.filter(
        (v) => mesesReferencia.includes(v.mesAnio) && v.marca === marca && v.empresa === empresa
      );

      // Validación Error 4: Marca sin ventas en meses de referencia
      if (ventasMesesReferencia.length === 0) {
        errores.push({
          tipo: 4,
          marca,
          fechaDestino,
          empresa,
          mensaje: `La marca "${marca}" de la empresa "${empresa}" no tiene ventas en los meses de referencia seleccionados`,
        });
        return;
      }

      // Calcular promedio de ventas para esta marca
      const sumaVentas = ventasMesesReferencia.reduce((sum, v) => sum + v.venta, 0);
      const promedioVentaMarca = sumaVentas / mesesReferencia.length;

      // Validación Error 3: Marca sin ventas para distribuir
      if (promedioVentaMarca === 0) {
        errores.push({
          tipo: 3,
          marca,
          fechaDestino,
          empresa,
          mensaje: `Falta de venta para distribución del presupuesto de la marca "${marca}" en la empresa "${empresa}"`,
        });
        return;
      }

      // Calcular factor de ajuste a nivel de marca
      const factorMarca = presupuesto / promedioVentaMarca;
      const porcentajeCambio = ((factorMarca - 1) * 100);

      // Agrupar ventas por cliente para esta marca
      const ventasPorCliente = new Map<string, { cliente: string; vendedor: string; empresa: string; ventas: typeof MOCK_DATA.ventas }>();

      ventasMesesReferencia.forEach((venta) => {
        if (!ventasPorCliente.has(venta.cliente)) {
          ventasPorCliente.set(venta.cliente, {
            cliente: venta.cliente,
            vendedor: venta.vendedor,
            empresa: venta.empresa,
            ventas: [],
          });
        }
        ventasPorCliente.get(venta.cliente)!.ventas.push(venta);
      });

      // Calcular distribución por cliente
      const distribucionClientes = Array.from(ventasPorCliente.values()).map((clienteData) => {
        const articulosMap = new Map<string, number>();

        // Sumar ventas por artículo
        clienteData.ventas.forEach((venta) => {
          const ventaActual = articulosMap.get(venta.articulo) || 0;
          articulosMap.set(venta.articulo, ventaActual + venta.venta);
        });

        // Calcular promedio por artículo y aplicar factor
        const articulos = Array.from(articulosMap.entries()).map(([articulo, ventaTotal]) => {
          const ventaPromedio = ventaTotal / mesesReferencia.length;
          const ventaAjustada = ventaPromedio * factorMarca;
          const variacion = ventaAjustada - ventaPromedio;

          return {
            articulo,
            ventaReal: ventaPromedio,
            ventaAjustada,
            variacion,
          };
        });

        const subtotal = articulos.reduce((sum, art) => sum + art.ventaAjustada, 0);

        return {
          cliente: clienteData.cliente,
          vendedor: clienteData.vendedor,
          empresa: clienteData.empresa,
          articulos,
          subtotal,
        };
      });

      resultadosMarcas.push({
        marca,
        fechaDestino,
        empresa,
        presupuesto,
        promedioVentaMesesReferencia: promedioVentaMarca,
        porcentajeCambio,
        distribucionClientes,
      });

      totalPresupuestoGeneral += presupuesto;
      totalPromedioReferenciaGeneral += promedioVentaMarca;
    });

    const resultadoFinal: CalculationResult = {
      totalPresupuesto: totalPresupuestoGeneral,
      promedioVentaReferencia: totalPromedioReferenciaGeneral / Math.max(resultadosMarcas.length, 1),
      resultadosMarcas,
      errores,
    };

    // Mostrar errores si existen
    if (errores.length > 0) {
      errores.forEach((error) => {
        toast.error(`Error ${error.tipo}: ${error.mensaje}`);
      });
    }

    // Mostrar promedio de ventas de referencia
    const promedioTotal = resultadosMarcas.reduce((sum, r) => sum + r.promedioVentaMesesReferencia, 0);
    const promedioMensaje = resultadosMarcas.length > 0 
      ? `Promedio de venta en meses de referencia: $${(promedioTotal / resultadosMarcas.length).toLocaleString("es-ES", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "No se calcularon marcas";
    
    toast.info(promedioMensaje);

    setResult(resultadoFinal);
  };

  if (!session || !user) {
    return null;
  }

  const vendedoresUnicos = Array.from(
    new Set(
      result?.resultadosMarcas.flatMap((m) =>
        m.distribucionClientes.map((c) => c.vendedor)
      ) || []
    )
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
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
            mockData={{
              marcas: MOCK_DATA.marcas,
              empresas: MOCK_DATA.empresas,
              articulos: MOCK_DATA.articulos,
            }}
            mesesDisponibles={mesesDisponibles}
            onMarcasPresupuestoLoad={setMarcasPresupuesto}
          />
            </Card>
          </div>

          <div className="lg:col-span-2">
            {result ? (
              <Tabs defaultValue="results" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="results">Resultados</TabsTrigger>
                  <TabsTrigger value="vendors">Vendedores-Clientes</TabsTrigger>
                  {userRole === "administrador" && (
                    <TabsTrigger value="roles">
                      <Shield className="h-4 w-4 mr-2" />
                      Roles
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="results" className="space-y-6">
                  {vendedoresUnicos.length > 0 && (
                    <Card className="p-4">
                      <VendorAdjustment 
                        vendedores={vendedoresUnicos}
                        presupuestoTotal={result.totalPresupuesto}
                        onAdjust={setVendorAdjustments}
                      />
                    </Card>
                  )}
                  
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricsCard
                      title="Presupuesto Total"
                      value={`$${result.totalPresupuesto.toLocaleString("es-ES", {
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
                      value={`$${result.promedioVentaReferencia.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                      icon={Calendar}
                      trend="neutral"
                      subtitle="Meses referencia"
                    />
                    <MetricsCard
                      title="Errores"
                      value={result.errores.length.toString()}
                      icon={Users}
                      trend={result.errores.length > 0 ? "negative" : "positive"}
                      subtitle="Marcas con error"
                    />
                  </div>

                  <BudgetResults result={result} />
                </TabsContent>

                <TabsContent value="vendors">
                  <VendorClientTable 
                    result={result}
                    vendorAdjustments={vendorAdjustments}
                    presupuestoTotal={result.totalPresupuesto}
                  />
                </TabsContent>

                {userRole === "administrador" && (
                  <TabsContent value="roles">
                    <RoleManagement />
                  </TabsContent>
                )}
              </Tabs>
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

        <FormulaExplanation />
      </main>
    </div>
  );
};

export default Index;
