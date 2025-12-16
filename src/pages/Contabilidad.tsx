import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

interface PresupuestoExcel {
  marca: string;
  articulo: string;
  fecha_destino: string;
  presupuesto: number;
}

const Contabilidad = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [presupuestosExcel, setPresupuestosExcel] = useState<PresupuestoExcel[]>([]);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Debe iniciar sesión");
      navigate("/auth");
      return;
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role_id, roles(nombre)")
      .eq("user_id", user.id)
      .maybeSingle();
    
    const roleName = (userRole?.roles as any)?.nombre;
    const hasAccess = roleName === "contabilidad" || roleName === "administrador";

    if (!hasAccess) {
      toast.error("No tiene permisos de contabilidad");
      navigate("/");
    }
  };

  const downloadTemplate = () => {
    const data = [
      { marca: "Nike", articulo: "Empresa Alpha", fecha_destino: "2025-12-31", presupuesto: 100000 },
      { marca: "Adidas", articulo: "Empresa Beta", fecha_destino: "2025-12-31", presupuesto: 150000 },
      { marca: "Puma", articulo: "Empresa Gamma", fecha_destino: "2025-12-31", presupuesto: 80000 }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presupuestos");
    XLSX.writeFile(wb, "plantilla_presupuestos_contabilidad.xlsx");
    
    toast.success("Plantilla descargada");
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      toast.loading("Analizando archivo...");
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as PresupuestoExcel[];

      if (jsonData.length === 0) {
        toast.dismiss();
        toast.error("No se encontraron datos válidos en el archivo");
        return;
      }

      // Validar columnas requeridas
      const requiredFields = ["marca", "articulo", "fecha_destino", "presupuesto"];
      const firstRow = jsonData[0];
      const missingColumns = requiredFields.filter(field => !(field in firstRow));

      if (missingColumns.length > 0) {
        toast.dismiss();
        toast.error(`Faltan columnas requeridas: ${missingColumns.join(", ")}`);
        return;
      }

      setPresupuestosExcel(jsonData);
      toast.dismiss();
      toast.success(`${jsonData.length} presupuestos cargados desde Excel`);
    } catch (error) {
      console.error("Error reading Excel:", error);
      toast.dismiss();
      toast.error("Error al leer el archivo Excel");
    }
    
    event.target.value = "";
  };

  const handleSubmit = async () => {
    if (presupuestosExcel.length === 0) {
      toast.error("Primero cargue un archivo Excel con presupuestos");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Get all marcas to validate
      const { data: marcasData } = await supabase
        .from("marcas")
        .select("codigo, nombre");

      const marcasMap = new Map(marcasData?.map(m => [m.nombre.toLowerCase(), m.codigo]) || []);

      // Get all clients
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("codigo, nombre");

      const clientesMap = new Map(clientesData?.map(c => [c.codigo, c.nombre]) || []);

      let successCount = 0;
      let errorCount = 0;

      for (const item of presupuestosExcel) {
        try {
          const marcaCodigo = marcasMap.get(item.marca.toLowerCase());
          
          if (!marcaCodigo) {
            console.warn(`Marca no encontrada: ${item.marca}`);
            errorCount++;
            continue;
          }

          // Get sales for this brand to distribute proportionally
          const { data: ventasData } = await supabase
            .from("ventas_reales")
            .select("codigo_cliente, monto")
            .eq("codigo_marca", marcaCodigo);

          if (!ventasData || ventasData.length === 0) {
            console.warn(`No hay ventas para la marca: ${item.marca}`);
            errorCount++;
            continue;
          }

          const totalVentas = ventasData.reduce((sum, v) => sum + v.monto, 0);

          // Calculate distribution proportionally
          const distribucionClientes = ventasData.map(venta => {
            const proporcion = venta.monto / totalVentas;
            const presupuestoCliente = item.presupuesto * proporcion;
            const clienteNombre = clientesMap.get(venta.codigo_cliente);
            
            if (!clienteNombre) {
              console.warn(`Cliente no encontrado: ${venta.codigo_cliente}`);
              return null;
            }

            return {
              cliente: clienteNombre,
              vendedor: "Sin vendedor",
              presupuesto: presupuestoCliente
            };
          }).filter(d => d !== null);

          // Save budget with distribution
          const { error: insertError } = await supabase
            .from("budgets")
            .insert({
              user_id: user.id,
              marca: item.marca,
              empresa: item.articulo,
              fecha_destino: item.fecha_destino,
              presupuesto: item.presupuesto,
              role: "contabilidad",
              vendor_adjustments: {
                distribucionClientes
              }
            });

          if (insertError) {
            console.error("Error insertando presupuesto:", insertError);
            errorCount++;
          } else {
            successCount++;
          }

        } catch (error) {
          console.error("Error procesando presupuesto:", error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} presupuestos cargados y distribuidos exitosamente`);
      }
      
      if (errorCount > 0) {
        toast.warning(`${errorCount} presupuestos con errores`);
      }
      
      // Reset form
      setPresupuestosExcel([]);

    } catch (error: any) {
      console.error("Error al cargar presupuestos:", error);
      toast.error(error.message || "Error al cargar presupuestos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Contabilidad</h1>
            <p className="text-muted-foreground mt-1">Carga de presupuestos por marca y artículo</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            Volver
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cargar Presupuestos desde Excel</CardTitle>
            <CardDescription>
              Descargue la plantilla, complete los datos (marca, artículo, fecha_destino, presupuesto) y cargue el archivo. 
              El sistema distribuirá automáticamente cada presupuesto entre los clientes según su historial de ventas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <Button variant="outline" onClick={downloadTemplate} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla
              </Button>
              
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                  id="excel-upload"
                />
                <Label htmlFor="excel-upload" className="w-full">
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Seleccionar Excel
                    </span>
                  </Button>
                </Label>
              </div>
            </div>

            {presupuestosExcel.length > 0 && (
              <div className="rounded-md border p-4 space-y-3">
                <h4 className="font-medium text-sm">
                  {presupuestosExcel.length} presupuesto(s) cargado(s)
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {presupuestosExcel.map((item, idx) => (
                    <div key={idx} className="text-sm bg-muted p-2 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.marca}</span>
                        <span className="text-muted-foreground">
                          ${item.presupuesto.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.articulo} • {item.fecha_destino}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleSubmit} 
              className="w-full" 
              disabled={loading || presupuestosExcel.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cargar y Distribuir {presupuestosExcel.length} Presupuesto(s)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contabilidad;
