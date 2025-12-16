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
  
  // Real data from Supabase
  const [clientes, setClientes] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [marcas, setMarcas] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [vendedores, setVendedores] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [ventas, setVentas] = useState<Array<{
    mes: string;
    codigo_marca: string;
    codigo_cliente: string;
    codigo_vendedor: string | null;
    monto: number;
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
        } = await supabase.from("user_roles").select("role_id, roles(nombre)").eq("user_id", session.user.id).maybeSingle();
        const role = (roleData?.roles as any)?.nombre || null;
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
        
        // Load real data from Supabase filtered by role permissions
        const userRoleId = roleData?.role_id;
        
        // Get allowed IDs based on role (handle pagination for large datasets)
        const fetchAllFromPerRole = async (table: "marcas_per_role" | "clientes_per_role" | "vendedores_per_role", idColumn: string, roleId: string) => {
          const allIds: string[] = [];
          let page = 0;
          const pageSize = 1000;
          while (true) {
            const { data } = await supabase
              .from(table)
              .select(idColumn)
              .eq("role_id", roleId)
              .range(page * pageSize, (page + 1) * pageSize - 1);
            if (!data || data.length === 0) break;
            allIds.push(...data.map((d: any) => d[idColumn]));
            if (data.length < pageSize) break;
            page++;
          }
          return allIds;
        };

        const [allowedMarcaIds, allowedClienteIds, allowedVendedorIds] = await Promise.all([
          fetchAllFromPerRole("marcas_per_role", "marca_id", userRoleId),
          fetchAllFromPerRole("clientes_per_role", "cliente_id", userRoleId),
          fetchAllFromPerRole("vendedores_per_role", "vendedor_id", userRoleId),
        ]);
        
        // Load data filtered by role permissions (batch for large ID sets)
        const fetchByIds = async (table: "clientes" | "marcas" | "vendedores", ids: string[]) => {
          if (ids.length === 0) return [];
          const allData: { codigo: string; nombre: string }[] = [];
          const batchSize = 500;
          for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const { data } = await supabase.from(table).select("codigo, nombre").in("id", batch);
            if (data) allData.push(...data);
          }
          return allData;
        };

        const [clientesData, marcasData, vendedoresData, ventasRes] = await Promise.all([
          fetchByIds("clientes", allowedClienteIds),
          fetchByIds("marcas", allowedMarcaIds),
          fetchByIds("vendedores", allowedVendedorIds),
          supabase.from("ventas_reales").select("mes, codigo_marca, codigo_cliente, codigo_vendedor, monto").limit(50000)
        ]);
        
        setClientes(clientesData);
        setMarcas(marcasData);
        setVendedores(vendedoresData);
        if (ventasRes.data) setVentas(ventasRes.data);
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
        } = await supabase.from("user_roles").select("role_id, roles(nombre)").eq("user_id", session.user.id).maybeSingle();
        const role = (roleData?.roles as any)?.nombre || null;
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
        
        // Load real data from Supabase filtered by role permissions
        const userRoleId2 = roleData?.role_id;
        
        // Get allowed IDs based on role (handle pagination for large datasets)
        const fetchAllFromPerRole2 = async (table: "marcas_per_role" | "clientes_per_role" | "vendedores_per_role", idColumn: string, roleId: string) => {
          const allIds: string[] = [];
          let page = 0;
          const pageSize = 1000;
          while (true) {
            const { data } = await supabase
              .from(table)
              .select(idColumn)
              .eq("role_id", roleId)
              .range(page * pageSize, (page + 1) * pageSize - 1);
            if (!data || data.length === 0) break;
            allIds.push(...data.map((d: any) => d[idColumn]));
            if (data.length < pageSize) break;
            page++;
          }
          return allIds;
        };

        const [allowedMarcaIds2, allowedClienteIds2, allowedVendedorIds2] = await Promise.all([
          fetchAllFromPerRole2("marcas_per_role", "marca_id", userRoleId2),
          fetchAllFromPerRole2("clientes_per_role", "cliente_id", userRoleId2),
          fetchAllFromPerRole2("vendedores_per_role", "vendedor_id", userRoleId2),
        ]);
        
        // Load data filtered by role permissions (batch for large ID sets)
        const fetchByIds2 = async (table: "clientes" | "marcas" | "vendedores", ids: string[]) => {
          if (ids.length === 0) return [];
          const allData: { codigo: string; nombre: string }[] = [];
          const batchSize = 500;
          for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const { data } = await supabase.from(table).select("codigo, nombre").in("id", batch);
            if (data) allData.push(...data);
          }
          return allData;
        };

        const [clientesData2, marcasData2, vendedoresData2, ventasRes2] = await Promise.all([
          fetchByIds2("clientes", allowedClienteIds2),
          fetchByIds2("marcas", allowedMarcaIds2),
          fetchByIds2("vendedores", allowedVendedorIds2),
          supabase.from("ventas_reales").select("mes, codigo_marca, codigo_cliente, codigo_vendedor, monto").limit(50000)
        ]);
        
        setClientes(clientesData2);
        setMarcas(marcasData2);
        setVendedores(vendedoresData2);
        if (ventasRes2.data) setVentas(ventasRes2.data);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  const handleCalculate = (marcasPresupuesto: MarcaPresupuesto[], mesesReferencia: string[]) => {
    console.log('🎯 Iniciando cálculo con:', { 
      marcasCount: marcasPresupuesto.length, 
      mesesReferencia,
      ventasCount: ventas.length,
      marcasDBCount: marcas.length
    });
    
    const resultadosMarcas: CalculationResult["resultadosMarcas"] = [];
    const errores: CalculationResult["errores"] = [];
    let totalPresupuestoGeneral = 0;
    let totalPromedioReferenciaGeneral = 0;
    
    // Create a map for quick lookups
    const marcasMap = new Map(marcas.map(m => [m.codigo, m.nombre]));
    const clientesMap = new Map(clientes.map(c => [c.codigo, c.nombre]));
    const vendedoresMap = new Map(vendedores.map(v => [v.codigo, v.nombre]));
    
    // Transform ventas to have mesAnio in correct format
    const ventasTransformadas = ventas.map(v => {
      let mesAnio = v.mes;
      
      // Convert database format to "mes-YYYY" format
      if (v.mes.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = v.mes.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const mes = date.toLocaleString("es-ES", { month: "long" });
        mesAnio = `${mes}-${year}`;
      } else if (v.mes.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        // Handle YYYY/MM/DD format
        const [year, month] = v.mes.split('/');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const mes = date.toLocaleString("es-ES", { month: "long" });
        mesAnio = `${mes}-${year}`;
      }
      
      return {
        ...v,
        mesAnio
      };
    });
    
    console.log('📊 Ventas transformadas (muestra):', ventasTransformadas.slice(0, 3));
    console.log('📊 Meses disponibles en ventas:', [...new Set(ventasTransformadas.map(v => v.mesAnio))]);
    
    marcasPresupuesto.forEach(marcaPresupuesto => {
      const {
        marca,
        fechaDestino,
        empresa,
        presupuesto
      } = marcaPresupuesto;

      console.log('🔍 Procesando marca:', marca);

      // Find marca codigo from nombre (case-insensitive)
      const marcaCodigo = Array.from(marcasMap.entries()).find(([_, nombre]) => 
        nombre.toLowerCase().trim() === marca.toLowerCase().trim()
      )?.[0];
      
      console.log('🔍 Código encontrado para', marca, ':', marcaCodigo);
      
      // Validación Error 1: Marca no existe
      if (!marcaCodigo) {
        console.error('❌ Marca no encontrada en BD:', marca);
        console.log('📋 Marcas disponibles:', Array.from(marcasMap.values()));
        errores.push({
          tipo: 1,
          marca,
          fechaDestino,
          empresa,
          mensaje: `La marca "${marca}" no existe en el maestro de marcas`
        });
        return;
      }

      // Obtener ventas de los meses de referencia para esta marca usando ventas transformadas
      const ventasMesesReferencia = ventasTransformadas.filter(v => 
        mesesReferencia.includes(v.mesAnio) && v.codigo_marca === marcaCodigo
      );
      
      console.log('📊 Ventas encontradas para', marca, ':', ventasMesesReferencia.length);

      // Validación Error 4: Marca sin ventas en meses de referencia
      if (ventasMesesReferencia.length === 0) {
        console.error('❌ No hay ventas para', marca, 'en meses:', mesesReferencia);
        console.log('📊 Ventas de esta marca en otros meses:', 
          ventasTransformadas.filter(v => v.codigo_marca === marcaCodigo).map(v => v.mesAnio)
        );
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
      const sumaVentas = ventasMesesReferencia.reduce((sum, v) => sum + v.monto, 0);
      const promedioVentaMarca = sumaVentas / mesesReferencia.length;
      
      console.log('💰 Promedio de venta para', marca, ':', promedioVentaMarca);

      // Validación Error 3: Marca sin ventas para distribuir
      if (promedioVentaMarca === 0) {
        console.error('❌ Promedio de venta es 0 para', marca);
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
      
      console.log('📈 Factor y % cambio para', marca, ':', { factorMarca, porcentajeCambio });

      // Agrupar ventas por cliente para esta marca
      const ventasPorCliente = new Map<string, {
        cliente: string;
        vendedor: string;
        ventas: Array<{mes: string; monto: number}>;
      }>();
      ventasMesesReferencia.forEach(venta => {
        // Always use client name, never fallback to code
        const clienteNombre = clientesMap.get(venta.codigo_cliente);
        
        // Skip if client name not found (data integrity issue)
        if (!clienteNombre) {
          console.warn(`Cliente no encontrado para código: ${venta.codigo_cliente}`);
          return;
        }
        
        const vendedorNombre = venta.codigo_vendedor 
          ? (vendedoresMap.get(venta.codigo_vendedor) || 'Sin vendedor') 
          : 'Sin vendedor';
        
        if (!ventasPorCliente.has(clienteNombre)) {
          ventasPorCliente.set(clienteNombre, {
            cliente: clienteNombre,
            vendedor: vendedorNombre,
            ventas: []
          });
        }
        ventasPorCliente.get(clienteNombre)!.ventas.push({
          mes: venta.mesAnio,
          monto: venta.monto
        });
      });
      
      console.log('👥 Clientes encontrados para', marca, ':', ventasPorCliente.size);

      const distribucionClientes: CalculationResult["resultadosMarcas"][0]["distribucionClientes"] = [];
      ventasPorCliente.forEach(clienteData => {
        const {
          cliente,
          vendedor
        } = clienteData;

        // Calcular promedio de ventas para este cliente
        const sumaVentasCliente = clienteData.ventas.reduce((sum, v) => sum + v.monto, 0);
        const promedioVentaCliente = sumaVentasCliente / mesesReferencia.length;

        // Calcular presupuesto ajustado para este cliente
        const presupuestoAjustadoCliente = promedioVentaCliente * factorMarca;

        // For now, create a single "article" entry with the client's total
        distribucionClientes.push({
          cliente,
          vendedor,
          empresa: empresa,
          articulos: [{
            articulo: marca, // Use marca as article name for now
            ventaReal: promedioVentaCliente,
            ventaAjustada: presupuestoAjustadoCliente,
            variacion: presupuestoAjustadoCliente - promedioVentaCliente
          }],
          subtotal: presupuestoAjustadoCliente
        });
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

    console.log('✅ Cálculo completado:', {
      marcasCalculadas: resultadosMarcas.length,
      errores: errores.length,
      totalPresupuesto: totalPresupuestoGeneral
    });
    
    if (errores.length > 0) {
      console.error('❌ Errores encontrados:', errores);
    }

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
                          {userRole === "admin_ventas" ? "Admin. Ventas" : userRole === "administrador" ? "Administrador" : userRole === "gerente" ? "Gerente" : userRole === "vendedor" ? "Vendedor" : userRole === "contabilidad" ? "Contabilidad" : userRole}
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
              {activeRole === "contabilidad" && (
                <Button variant="default" size="sm" onClick={() => navigate("/contabilidad")}>
                  Cargar Presupuesto
                </Button>
              )}
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
                    marcas: marcas.map(m => m.nombre),
                    empresas: ["Cofersa", "Empresa Alpha", "Empresa Beta", "Empresa Gamma"],
                    articulos: marcas.reduce((acc, m) => {
                      acc[m.nombre] = [m.nombre];
                      return acc;
                    }, {} as Record<string, string[]>)
                  }}
                  mesesDisponibles={mesesDisponibles} 
                  onMarcasPresupuestoLoad={setMarcasPresupuesto} 
                  historicalBudgets={allHistoricalBudgets} 
                  ventasData={(() => {
                    // Create maps once, outside the map function
                    const marcasMap = new Map(marcas.map(m => [m.codigo, m.nombre]));
                    const clientesMap = new Map(clientes.map(c => [c.codigo, c.nombre]));
                    const vendedoresMap = new Map(vendedores.map(v => [v.codigo, v.nombre]));
                    
                    const ventasTransformadas = ventas.map(v => {
                      // Convert mes format from database to match mesesDisponibles format
                      // Database format might be "2024-11" or "noviembre-2024"
                      let mesAnio = v.mes;
                      
                      // If format is "YYYY-MM", convert to "mes-YYYY"
                      if (v.mes.match(/^\d{4}-\d{2}$/)) {
                        const [year, month] = v.mes.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                        const mes = date.toLocaleString("es-ES", { month: "long" });
                        mesAnio = `${mes}-${year}`;
                      }
                      
                      // Only include if client name is found
                      const clienteNombre = clientesMap.get(v.codigo_cliente);
                      if (!clienteNombre) return null;
                      
                      return {
                        mesAnio,
                        marca: marcasMap.get(v.codigo_marca) || v.codigo_marca,
                        cliente: clienteNombre,
                        articulo: marcasMap.get(v.codigo_marca) || v.codigo_marca,
                        vendedor: v.codigo_vendedor 
                          ? (vendedoresMap.get(v.codigo_vendedor) || v.codigo_vendedor)
                          : 'Sin vendedor',
                        empresa: "Empresa Alpha",
                        venta: v.monto
                      };
                    }).filter((v): v is NonNullable<typeof v> => v !== null);
                    
                    console.log('Ventas transformadas sample:', ventasTransformadas.slice(0, 3));
                    console.log('Meses disponibles sample:', mesesDisponibles.slice(0, 3));
                    console.log('Total ventas:', ventasTransformadas.length);
                    console.log('Marcas disponibles:', marcas.map(m => m.nombre));
                    
                    return ventasTransformadas;
                  })()}
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