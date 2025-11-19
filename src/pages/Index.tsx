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
import { SuggestedBudget } from "@/components/SuggestedBudget";
import { DataImport } from "@/components/DataImport";
import { CSVImport } from "@/components/CSVImport";
import { VendorBudgetView } from "@/components/VendorBudgetView";
import { Calculator, TrendingUp, Calendar, Users, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    "New Balance": ["New Balance 574", "New Balance 990", "New Balance 327"]
  } as Record<string, string[]>,
  ventas: [] as Array<{
    mesAnio: string;
    marca: string;
    cliente: string;
    articulo: string;
    vendedor: string;
    empresa: string;
    venta: number;
  }>
};
const generarMesesAnio = () => {
  const meses = [];
  const hoy = new Date();
  for (let i = 0; i < 24; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const mes = fecha.toLocaleString("es-ES", {
      month: "long"
    });
    const anio = fecha.getFullYear();
    meses.push(`${mes}-${anio}`);
  }
  return meses;
};
const mesesDisponibles = generarMesesAnio();

// Generar datos de ventas para los últimos 24 meses (excepto New Balance que no tiene ventas)
mesesDisponibles.forEach(mesAnio => {
  MOCK_DATA.marcas.forEach(marca => {
    // New Balance no tiene ventas (para demostrar Error 3)
    if (marca === "New Balance") return;
    MOCK_DATA.clientes.forEach(cliente => {
      MOCK_DATA.articulos[marca]?.forEach(articulo => {
        const vendedor = MOCK_DATA.vendedores[Math.floor(Math.random() * MOCK_DATA.vendedores.length)];
        const empresa = MOCK_DATA.empresas[Math.floor(Math.random() * MOCK_DATA.empresas.length)];
        MOCK_DATA.ventas.push({
          mesAnio,
          marca,
          cliente,
          articulo,
          vendedor,
          empresa,
          venta: Math.random() * 10000 + 5000
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
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [marcasPresupuesto, setMarcasPresupuesto] = useState<MarcaPresupuesto[]>([]);
  const [vendorAdjustments, setVendorAdjustments] = useState<Record<string, {
    value: number;
    type: "percentage" | "currency";
  }>>({});
  const [brandAdjustments, setBrandAdjustments] = useState<Record<string, number>>({});
  const [allHistoricalBudgets, setAllHistoricalBudgets] = useState<Array<{
    marca: string;
    empresa: string;
    presupuesto: number;
    fechaDestino: string;
  }>>([]);
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        // Load user role
        const {
          data: roleData
        } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
        const role = roleData?.role || null;
        setUserRole(role);
        setSimulatedRole(role);

        // Load historical budgets from database
        const {
          data: budgets
        } = await supabase.from("budgets").select("marca, empresa, presupuesto, fecha_destino, vendor_adjustments").eq("user_id", session.user.id);
        if (budgets && budgets.length > 0) {
          const historicalData = budgets.map(b => ({
            marca: b.marca,
            empresa: b.empresa,
            presupuesto: b.presupuesto,
            fechaDestino: b.fecha_destino
          }));
          setAllHistoricalBudgets(historicalData);
          
          // Load vendor adjustments from last budget
          if (budgets[0]?.vendor_adjustments) {
            const adjustments = budgets[0].vendor_adjustments as any;
            if (adjustments.brandAdjustments) {
              setBrandAdjustments(adjustments.brandAdjustments);
            } else {
              setVendorAdjustments(adjustments);
            }
          }
        }
      }
    });
    supabase.auth.getSession().then(async ({
      data: {
        session
      }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        // Load user role
        const {
          data: roleData
        } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
        const role = roleData?.role || null;
        setUserRole(role);
        setSimulatedRole(role);

        // Load historical budgets from database
        const {
          data: budgets
        } = await supabase.from("budgets").select("marca, empresa, presupuesto, fecha_destino, vendor_adjustments").eq("user_id", session.user.id);
        if (budgets && budgets.length > 0) {
          const historicalData = budgets.map(b => ({
            marca: b.marca,
            empresa: b.empresa,
            presupuesto: b.presupuesto,
            fechaDestino: b.fecha_destino
          }));
          setAllHistoricalBudgets(historicalData);
          
          // Load vendor adjustments from last budget
          if (budgets[0]?.vendor_adjustments) {
            const adjustments = budgets[0].vendor_adjustments as any;
            if (adjustments.brandAdjustments) {
              setBrandAdjustments(adjustments.brandAdjustments);
            } else {
              setVendorAdjustments(adjustments);
            }
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  const handleCalculate = (marcasPresupuesto: MarcaPresupuesto[], mesesReferencia: string[]) => {
    const resultadosMarcas: CalculationResult["resultadosMarcas"] = [];
    const errores: CalculationResult["errores"] = [];
    let totalPresupuestoGeneral = 0;
    let totalPromedioReferenciaGeneral = 0;
    marcasPresupuesto.forEach(marcaPresupuesto => {
      const {
        marca,
        fechaDestino,
        empresa,
        presupuesto
      } = marcaPresupuesto;

      // Validación Error 1: Marca no existe
      if (!MOCK_DATA.marcas.includes(marca)) {
        errores.push({
          tipo: 1,
          marca,
          fechaDestino,
          empresa,
          mensaje: `La marca "${marca}" no existe en el maestro de marcas`
        });
        return;
      }

      // Obtener ventas de los meses de referencia para esta marca y empresa
      const ventasMesesReferencia = MOCK_DATA.ventas.filter(v => mesesReferencia.includes(v.mesAnio) && v.marca === marca && v.empresa === empresa);

      // Validación Error 4: Marca sin ventas en meses de referencia
      if (ventasMesesReferencia.length === 0) {
        errores.push({
          tipo: 4,
          marca,
          fechaDestino,
          empresa,
          mensaje: `La marca "${marca}" de la empresa "${empresa}" no tiene ventas en los meses de referencia seleccionados`
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
          mensaje: `Falta de venta para distribución del presupuesto de la marca "${marca}" en la empresa "${empresa}"`
        });
        return;
      }

      // Calcular factor de ajuste a nivel de marca
      const factorMarca = presupuesto / promedioVentaMarca;
      const porcentajeCambio = (factorMarca - 1) * 100;

      // Agrupar ventas por cliente para esta marca
      const ventasPorCliente = new Map<string, {
        cliente: string;
        vendedor: string;
        empresa: string;
        ventas: typeof MOCK_DATA.ventas;
      }>();
      ventasMesesReferencia.forEach(venta => {
        if (!ventasPorCliente.has(venta.cliente)) {
          ventasPorCliente.set(venta.cliente, {
            cliente: venta.cliente,
            vendedor: venta.vendedor,
            empresa: venta.empresa,
            ventas: []
          });
        }
        ventasPorCliente.get(venta.cliente)!.ventas.push(venta);
      });

      // Calcular distribución por cliente
      const distribucionClientes = Array.from(ventasPorCliente.values()).map(clienteData => {
        const articulosMap = new Map<string, number>();

        // Sumar ventas por artículo
        clienteData.ventas.forEach(venta => {
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
            variacion
          };
        });
        const subtotal = articulos.reduce((sum, art) => sum + art.ventaAjustada, 0);
        return {
          cliente: clienteData.cliente,
          vendedor: clienteData.vendedor,
          empresa: clienteData.empresa,
          articulos,
          subtotal
        };
      });
      resultadosMarcas.push({
        marca,
        fechaDestino,
        empresa,
        presupuesto,
        promedioVentaMesesReferencia: promedioVentaMarca,
        porcentajeCambio,
        distribucionClientes
      });
      totalPresupuestoGeneral += presupuesto;
      totalPromedioReferenciaGeneral += promedioVentaMarca;
    });

    // Store historical budget data for suggestions in database
    const historicalBudgets = marcasPresupuesto.map(mp => ({
      marca: mp.marca,
      empresa: mp.empresa,
      presupuesto: mp.presupuesto,
      fechaDestino: mp.fechaDestino
    }));
    setAllHistoricalBudgets(prev => [...prev, ...historicalBudgets]);

    // Save budgets to database for future suggestions
    if (user) {
      const budgetsToInsert = marcasPresupuesto.map(mp => ({
        user_id: user.id,
        marca: mp.marca,
        empresa: mp.empresa,
        presupuesto: mp.presupuesto,
        fecha_destino: mp.fechaDestino,
        role: userRole as "administrador" | "gerente" | "admin_ventas" || 'administrador'
      }));
      supabase.from('budgets').insert(budgetsToInsert).then(({
        error
      }) => {
        if (error) {
          console.error('Error saving budgets:', error);
        } else {
          console.log('Budgets saved successfully');
        }
      });
    }
    const resultadoFinal: CalculationResult = {
      totalPresupuesto: totalPresupuestoGeneral,
      promedioVentaReferencia: totalPromedioReferenciaGeneral / Math.max(resultadosMarcas.length, 1),
      resultadosMarcas,
      errores
    };

    // Mostrar errores si existen
    if (errores.length > 0) {
      errores.forEach(error => {
        toast.error(`Error ${error.tipo}: ${error.mensaje}`);
      });
    }

    // Mostrar promedio de ventas de referencia
    const promedioTotal = resultadosMarcas.reduce((sum, r) => sum + r.promedioVentaMesesReferencia, 0);
    const promedioMensaje = resultadosMarcas.length > 0 ? `Promedio de venta en meses de referencia: $${(promedioTotal / resultadosMarcas.length).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}` : "No se calcularon marcas";
    toast.info(promedioMensaje);
    setResult(resultadoFinal);
  };
  if (!session || !user) {
    return null;
  }
  const activeRole = simulatedRole || userRole;
  const vendedoresUnicos = Array.from(new Set(result?.resultadosMarcas.flatMap(m => m.distribucionClientes.map(c => c.vendedor)) || []));
  const availableRoles = [{
    value: "administrador",
    label: "Administrador"
  }, {
    value: "gerente",
    label: "Gerente"
  }, {
    value: "admin_ventas",
    label: "Admin. Ventas"
  }, {
    value: "vendedor",
    label: "Vendedor"
  }];
  const handleRoleChange = (newRole: string) => {
    setSimulatedRole(newRole);
    toast.info(`Vista cambiada a: ${availableRoles.find(r => r.value === newRole)?.label}`);
  };
  return <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2.5">
                <Calculator className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Sistema de Cálculo de Presupuestos y Meta</h1>
                <p className="text-sm text-muted-foreground">
                  Análisis dinámico basado en datos históricos de ventas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-foreground">
                    {user.email}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    {userRole ? <>
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                          <Shield className="h-3 w-3 inline mr-1" />
                          {userRole === "admin_ventas" ? "Admin. Ventas" : userRole === "administrador" ? "Administrador" : userRole === "gerente" ? "Gerente" : userRole === "vendedor" ? "Vendedor" : userRole}
                        </span>
                        <Select value={activeRole || undefined} onValueChange={handleRoleChange}>
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue placeholder="Ver como..." />
                          </SelectTrigger>
                          <SelectContent className="bg-card z-50">
                            {availableRoles.map(role => <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>)}
                          </SelectContent>
                        </Select>
                      </> : <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        Sin rol asignado
                      </span>}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeRole === "vendedor" ? (
          <VendorBudgetView />
        ) : (
          <div className="space-y-6">
            <Card className="p-6 shadow-md">
                <BudgetForm 
                  onCalculate={handleCalculate} 
                  mockData={{
                    marcas: MOCK_DATA.marcas,
                    empresas: MOCK_DATA.empresas,
                    articulos: MOCK_DATA.articulos
                  }} 
                  mesesDisponibles={mesesDisponibles} 
                  onMarcasPresupuestoLoad={setMarcasPresupuesto} 
                  historicalBudgets={allHistoricalBudgets} 
                  ventasData={MOCK_DATA.ventas}
                  vendorAdjustments={vendorAdjustments}
                  brandAdjustments={brandAdjustments}
                  presupuestoTotal={marcasPresupuesto.reduce((sum, mp) => sum + mp.presupuesto, 0)}
                />
            </Card>

            <div>
            {activeRole === "administrador" ? <Tabs defaultValue="results" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="results" className="text-sm">Parámetros</TabsTrigger>
                  <TabsTrigger value="vendors" disabled={!result} className="text-sm">Vendedores-Clientes</TabsTrigger>
                  <TabsTrigger value="import" className="text-sm">Importar Datos</TabsTrigger>
                  <TabsTrigger value="roles" className="text-sm flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Usuarios</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-6">
                  {result && activeRole === "administrador" && vendedoresUnicos.length > 0 && <Card className="p-4">
                      <VendorAdjustment 
                        vendedores={vendedoresUnicos} 
                        presupuestoTotal={result.resultadosMarcas.reduce((sum, m) => 
                          sum + m.distribucionClientes.reduce((s, c) => s + c.subtotal, 0), 0
                        )} 
                        onAdjust={setVendorAdjustments}
                        marcasPresupuesto={marcasPresupuesto}
                        userId={user.id}
                        userRole={userRole}
                      />
                    </Card>}
                  
                  {result && <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricsCard 
                      title="Presupuesto Base" 
                      value={`$${result.resultadosMarcas.reduce((sum, m) => 
                        sum + m.distribucionClientes.reduce((s, c) => s + c.subtotal, 0), 0
                      ).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`} 
                      icon={TrendingUp} 
                      trend="neutral" 
                      subtitle="Suma Ppto Asociado"
                    />
                    <MetricsCard 
                      title="Ppto Excel" 
                      value={`$${result.totalPresupuesto.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`} 
                      icon={Calculator} 
                      trend="neutral" 
                      subtitle="Total del archivo"
                    />
                    <MetricsCard 
                      title="Venta Real" 
                      value={`$${result.resultadosMarcas.reduce((sum, m) => 
                        sum + m.distribucionClientes.reduce((s, c) => 
                          s + c.articulos.reduce((a, art) => a + art.ventaReal, 0), 0
                        ), 0
                      ).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
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
                  <FormulaExplanation />
                  </>}
                </TabsContent>

                {result && (activeRole === "administrador" || activeRole === "admin_ventas") && <TabsContent value="vendors">
                    <VendorClientTable 
                      result={result} 
                      vendorAdjustments={vendorAdjustments} 
                      presupuestoTotal={result.resultadosMarcas.reduce((sum, m) => 
                        sum + m.distribucionClientes.reduce((s, c) => s + c.subtotal, 0), 0
                      )} 
                      userRole={activeRole}
                      marcasPresupuesto={marcasPresupuesto}
                      userId={user.id}
                      onBrandAdjustmentsChange={setBrandAdjustments}
                    />
                  </TabsContent>}

                <TabsContent value="import">
                  <CSVImport />
                </TabsContent>

                <TabsContent value="roles">
                  <RoleManagement />
                </TabsContent>
              </Tabs> : <Tabs defaultValue="results" className="space-y-6">
                <TabsList className={`grid w-full ${activeRole === "gerente" || activeRole === "admin_ventas" ? "grid-cols-2" : "grid-cols-1"}`}>
                  <TabsTrigger value="results">Parámetros</TabsTrigger>
                  {(activeRole === "gerente" || activeRole === "admin_ventas") && <TabsTrigger value="vendors">Vendedores-Clientes</TabsTrigger>}
                </TabsList>

                <TabsContent value="results" className="space-y-6">
                  {result && (activeRole === "administrador" || activeRole === "gerente" || activeRole === "admin_ventas") && vendedoresUnicos.length > 0 && <Card className="p-4">
                      <VendorAdjustment 
                        vendedores={vendedoresUnicos} 
                        presupuestoTotal={result.resultadosMarcas.reduce((sum, m) => 
                          sum + m.distribucionClientes.reduce((s, c) => s + c.subtotal, 0), 0
                        )} 
                        onAdjust={setVendorAdjustments}
                        marcasPresupuesto={marcasPresupuesto}
                        userId={user.id}
                        userRole={userRole}
                      />
                    </Card>}
                  
                  {result && <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricsCard 
                      title="Presupuesto Base" 
                      value={`$${result.resultadosMarcas.reduce((sum, m) => 
                        sum + m.distribucionClientes.reduce((s, c) => s + c.subtotal, 0), 0
                      ).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`} 
                      icon={TrendingUp} 
                      trend="neutral" 
                      subtitle="Suma Ppto Asociado"
                    />
                    <MetricsCard 
                      title="Ppto Excel" 
                      value={`$${result.totalPresupuesto.toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`} 
                      icon={Calculator} 
                      trend="neutral" 
                      subtitle="Total del archivo"
                    />
                    <MetricsCard 
                      title="Venta Real" 
                      value={`$${result.resultadosMarcas.reduce((sum, m) => 
                        sum + m.distribucionClientes.reduce((s, c) => 
                          s + c.articulos.reduce((a, art) => a + art.ventaReal, 0), 0
                        ), 0
                      ).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
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
                  <FormulaExplanation />
                  </>}
                </TabsContent>

                {result && (activeRole === "gerente" || activeRole === "admin_ventas") && <TabsContent value="vendors">
                    <VendorClientTable 
                      result={result} 
                      vendorAdjustments={vendorAdjustments} 
                      presupuestoTotal={result.resultadosMarcas.reduce((sum, m) => 
                        sum + m.distribucionClientes.reduce((s, c) => s + c.subtotal, 0), 0
                      )} 
                      userRole={activeRole}
                      marcasPresupuesto={marcasPresupuesto}
                      userId={user.id}
                      onBrandAdjustmentsChange={setBrandAdjustments}
                    />
                  </TabsContent>}
              </Tabs>}
            </div>
          </div>
        )}
      </main>
    </div>;
};
export default Index;