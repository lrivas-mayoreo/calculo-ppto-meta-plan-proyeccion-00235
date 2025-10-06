import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator } from "lucide-react";
import { toast } from "sonner";

interface BudgetFormProps {
  onCalculate: (
    marca: string,
    articulo: string,
    mesDestino: number,
    presupuesto: number,
    mesesReferencia: number[]
  ) => void;
  mockData: {
    marcas: string[];
    articulos: Record<string, string[]>;
  };
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const BudgetForm = ({ onCalculate, mockData }: BudgetFormProps) => {
  const [marca, setMarca] = useState("");
  const [articulo, setArticulo] = useState("");
  const [mesDestino, setMesDestino] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [mesesReferencia, setMesesReferencia] = useState<number[]>([]);

  const handleMesToggle = (mesNum: number) => {
    setMesesReferencia((prev) =>
      prev.includes(mesNum) ? prev.filter((m) => m !== mesNum) : [...prev, mesNum]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!marca || !articulo || !mesDestino || !presupuesto) {
      toast.error("Por favor complete todos los campos obligatorios");
      return;
    }

    if (mesesReferencia.length === 0) {
      toast.error("Seleccione al menos un mes de referencia");
      return;
    }

    const presupuestoNum = parseFloat(presupuesto);
    if (isNaN(presupuestoNum) || presupuestoNum <= 0) {
      toast.error("Ingrese un presupuesto válido");
      return;
    }

    onCalculate(marca, articulo, parseInt(mesDestino), presupuestoNum, mesesReferencia);
    toast.success("Cálculo realizado exitosamente");
  };

  const articulosDisponibles = marca ? mockData.articulos[marca] || [] : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Parámetros de Cálculo</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="marca">Marca *</Label>
        <Select value={marca} onValueChange={(value) => {
          setMarca(value);
          setArticulo("");
        }}>
          <SelectTrigger id="marca">
            <SelectValue placeholder="Seleccione una marca" />
          </SelectTrigger>
          <SelectContent>
            {mockData.marcas.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="articulo">Artículo *</Label>
        <Select value={articulo} onValueChange={setArticulo} disabled={!marca}>
          <SelectTrigger id="articulo">
            <SelectValue placeholder="Seleccione un artículo" />
          </SelectTrigger>
          <SelectContent>
            {articulosDisponibles.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mesDestino">Mes Destino *</Label>
        <Select value={mesDestino} onValueChange={setMesDestino}>
          <SelectTrigger id="mesDestino">
            <SelectValue placeholder="Seleccione el mes destino" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((mes, idx) => (
              <SelectItem key={idx + 1} value={String(idx + 1)}>
                {mes}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="presupuesto">Presupuesto a Distribuir *</Label>
        <Input
          id="presupuesto"
          type="number"
          placeholder="20000"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
          min="0"
          step="0.01"
        />
      </div>

      <div className="space-y-3">
        <Label>Meses de Referencia *</Label>
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-4">
          {MESES.map((mes, idx) => (
            <div key={idx + 1} className="flex items-center space-x-2">
              <Checkbox
                id={`mes-${idx + 1}`}
                checked={mesesReferencia.includes(idx + 1)}
                onCheckedChange={() => handleMesToggle(idx + 1)}
              />
              <label
                htmlFor={`mes-${idx + 1}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {mes}
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Seleccionados: {mesesReferencia.length} mes(es)
        </p>
      </div>

      <Button type="submit" className="w-full">
        <Calculator className="mr-2 h-4 w-4" />
        Calcular Presupuesto
      </Button>
    </form>
  );
};
