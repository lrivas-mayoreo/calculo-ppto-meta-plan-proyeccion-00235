import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Marca {
  codigo: string;
  nombre: string;
}

const Contabilidad = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [selectedMarca, setSelectedMarca] = useState("");
  const [articulo, setArticulo] = useState("");
  const [fechaDestino, setFechaDestino] = useState("");
  const [presupuesto, setPresupuesto] = useState("");

  useEffect(() => {
    checkRole();
    loadMarcas();
  }, []);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Debe iniciar sesión");
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "contabilidad")
      .single();

    if (!roleData) {
      toast.error("No tiene permisos de contabilidad");
      navigate("/");
    }
  };

  const loadMarcas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("marcas")
      .select("codigo, nombre")
      .eq("user_id", user.id)
      .order("nombre");

    if (error) {
      toast.error("Error al cargar marcas");
      return;
    }

    setMarcas(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMarca || !articulo || !fechaDestino || !presupuesto) {
      toast.error("Complete todos los campos");
      return;
    }

    const presupuestoNum = parseFloat(presupuesto);
    if (isNaN(presupuestoNum) || presupuestoNum <= 0) {
      toast.error("Ingrese un presupuesto válido");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Get marca name
      const marcaObj = marcas.find(m => m.codigo === selectedMarca);
      if (!marcaObj) throw new Error("Marca no encontrada");

      // Get codigo_marca for the selected brand
      const { data: ventasData, error: ventasError } = await supabase
        .from("ventas_reales")
        .select("codigo_cliente, monto")
        .eq("user_id", user.id)
        .eq("codigo_marca", selectedMarca);

      if (ventasError) throw ventasError;

      if (!ventasData || ventasData.length === 0) {
        toast.error("No hay ventas para esta marca. No se puede distribuir el presupuesto.");
        setLoading(false);
        return;
      }

      // Get client names
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("codigo, nombre")
        .eq("user_id", user.id);

      const clientesMap = new Map(clientesData?.map(c => [c.codigo, c.nombre]) || []);

      // Calculate total sales
      const totalVentas = ventasData.reduce((sum, v) => sum + v.monto, 0);

      // Calculate distribution proportionally
      const distribucionClientes = ventasData.map(venta => {
        const proporcion = venta.monto / totalVentas;
        const presupuestoCliente = presupuestoNum * proporcion;
        const clienteNombre = clientesMap.get(venta.codigo_cliente);
        
        if (!clienteNombre) {
          console.warn(`Cliente no encontrado: ${venta.codigo_cliente}`);
          return null;
        }

        return {
          cliente: clienteNombre,
          vendedor: "Sin vendedor", // Can be enhanced later
          presupuesto: presupuestoCliente
        };
      }).filter(d => d !== null);

      // Save budget with distribution
      const { error: insertError } = await supabase
        .from("budgets")
        .insert({
          user_id: user.id,
          marca: marcaObj.nombre,
          empresa: articulo,
          fecha_destino: fechaDestino,
          presupuesto: presupuestoNum,
          role: "contabilidad",
          vendor_adjustments: {
            distribucionClientes
          }
        });

      if (insertError) throw insertError;

      toast.success("Presupuesto cargado y distribuido exitosamente");
      
      // Reset form
      setSelectedMarca("");
      setArticulo("");
      setFechaDestino("");
      setPresupuesto("");

    } catch (error: any) {
      console.error("Error al cargar presupuesto:", error);
      toast.error(error.message || "Error al cargar presupuesto");
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
            <CardTitle>Cargar Presupuesto</CardTitle>
            <CardDescription>
              Complete los datos para cargar un presupuesto. Se distribuirá automáticamente entre los clientes según su historial de ventas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="marca">Marca</Label>
                <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                  <SelectTrigger id="marca">
                    <SelectValue placeholder="Seleccione una marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {marcas.map(marca => (
                      <SelectItem key={marca.codigo} value={marca.codigo}>
                        {marca.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="articulo">Artículo / Empresa</Label>
                <Input
                  id="articulo"
                  value={articulo}
                  onChange={(e) => setArticulo(e.target.value)}
                  placeholder="Ingrese el artículo o empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha Destino</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fechaDestino}
                  onChange={(e) => setFechaDestino(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="presupuesto">Presupuesto Total</Label>
                <Input
                  id="presupuesto"
                  type="number"
                  step="0.01"
                  value={presupuesto}
                  onChange={(e) => setPresupuesto(e.target.value)}
                  placeholder="Ingrese el monto del presupuesto"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cargar y Distribuir Presupuesto
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contabilidad;
