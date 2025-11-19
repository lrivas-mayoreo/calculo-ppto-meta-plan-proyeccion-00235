import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import type { CalculationResult } from "@/pages/Index";

interface VendorBudgetDistributionProps {
  result: CalculationResult;
  vendorCode: string;
  onDistribute: () => void;
}

export const VendorBudgetDistribution = ({
  result,
  vendorCode,
  onDistribute,
}: VendorBudgetDistributionProps) => {
  const [open, setOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [sourceClient, setSourceClient] = useState<string>("");
  const [targetClient, setTargetClient] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [operation, setOperation] = useState<"transfer" | "add">("transfer");

  // Filtrar datos por vendedor
  const vendorData = result.resultadosMarcas
    .map((marca) => ({
      ...marca,
      distribucionClientes: marca.distribucionClientes.filter(
        (c) => c.vendedor === vendorCode
      ),
    }))
    .filter((marca) => marca.distribucionClientes.length > 0);

  const brands = vendorData.map((m) => m.marca);
  const clients =
    vendorData
      .find((m) => m.marca === selectedBrand)
      ?.distribucionClientes.map((c) => c.cliente) || [];

  const sourceClientBudget =
    vendorData
      .find((m) => m.marca === selectedBrand)
      ?.distribucionClientes.find((c) => c.cliente === sourceClient)
      ?.subtotal || 0;

  const handleDistribute = () => {
    if (!selectedBrand || !sourceClient || !targetClient || amount <= 0) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    if (amount > sourceClientBudget) {
      toast.error("El monto excede el presupuesto disponible");
      return;
    }

    if (sourceClient === targetClient) {
      toast.error("El cliente origen y destino deben ser diferentes");
      return;
    }

    toast.success(
      `${
        operation === "transfer" ? "Transferidos" : "Sumados"
      } $${amount.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} de ${sourceClient} a ${targetClient} en marca ${selectedBrand}`
    );

    onDistribute();
    setOpen(false);
    
    // Reset form
    setSelectedBrand("");
    setSourceClient("");
    setTargetClient("");
    setAmount(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Distribuir Presupuesto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle>Distribuir Presupuesto Entre Clientes</DialogTitle>
          <DialogDescription>
            Transfiera o sume presupuesto de una marca entre sus clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Operación</Label>
            <Select
              value={operation}
              onValueChange={(value) => setOperation(value as "transfer" | "add")}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="transfer">Transferir (resta de origen)</SelectItem>
                <SelectItem value="add">Sumar (mantiene origen)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Marca</Label>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar marca" />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBrand && (
            <>
              <div className="space-y-2">
                <Label>Cliente Origen</Label>
                <Select value={sourceClient} onValueChange={setSourceClient}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Seleccionar cliente origen" />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    {clients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sourceClient && (
                  <p className="text-sm text-muted-foreground">
                    Presupuesto disponible: $
                    {sourceClientBudget.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Cliente Destino</Label>
                <Select value={targetClient} onValueChange={setTargetClient}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Seleccionar cliente destino" />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    {clients
                      .filter((c) => c !== sourceClient)
                      .map((client) => (
                        <SelectItem key={client} value={client}>
                          {client}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Ingrese el monto"
                  className="bg-background"
                  max={sourceClientBudget}
                  min={0}
                  step={0.01}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDistribute}>
            {operation === "transfer" ? "Transferir" : "Sumar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
