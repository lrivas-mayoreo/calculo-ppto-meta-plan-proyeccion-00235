import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ErrorItem {
  tipo: number;
  marca: string;
  mensaje: string;
}

interface ErrorsDetailCardProps {
  errores: ErrorItem[];
}

const getErrorTypeLabel = (tipo: number): { label: string; color: string } => {
  switch (tipo) {
    case 1:
      return { label: "Marca no encontrada", color: "text-destructive" };
    case 2:
      return { label: "Sin ventas históricas", color: "text-amber-600" };
    case 3:
      return { label: "Promedio cero", color: "text-orange-600" };
    case 4:
      return { label: "Fechas inválidas", color: "text-amber-600" };
    default:
      return { label: "Error desconocido", color: "text-destructive" };
  }
};

export const ErrorsDetailCard = ({ errores }: ErrorsDetailCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasErrors = errores.length > 0;

  // Agrupar errores por tipo
  const erroresPorTipo = errores.reduce((acc, error) => {
    if (!acc[error.tipo]) {
      acc[error.tipo] = [];
    }
    acc[error.tipo].push(error);
    return acc;
  }, {} as Record<number, ErrorItem[]>);

  if (!hasErrors) {
    return (
      <Card className="p-5 shadow-md transition-all hover:shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Errores</p>
            <p className="mt-2 text-2xl font-bold text-accent">0</p>
            <p className="mt-1 text-xs text-muted-foreground">Sin errores detectados</p>
          </div>
          <div className="rounded-lg p-2.5 bg-accent/10">
            <CheckCircle className="h-5 w-5 text-accent" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 shadow-md transition-all hover:shadow-lg border-destructive/30">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">Errores</p>
          <p className="mt-2 text-2xl font-bold text-destructive">{errores.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Marcas con error</p>
        </div>
        <div className="rounded-lg p-2.5 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
      </div>

      {/* Botón expandir/colapsar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-3 text-muted-foreground hover:text-foreground"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4 mr-1" />
            Ocultar detalles
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Ver detalles ({errores.length} errores)
          </>
        )}
      </Button>

      {/* Detalle de errores */}
      {isExpanded && (
        <ScrollArea className="mt-3 max-h-48">
          <div className="space-y-3">
            {Object.entries(erroresPorTipo).map(([tipo, erroresDelTipo]) => {
              const { label, color } = getErrorTypeLabel(Number(tipo));
              return (
                <div key={tipo} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={cn("h-4 w-4", color)} />
                    <span className={cn("text-sm font-medium", color)}>{label}</span>
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                      {erroresDelTipo.length}
                    </span>
                  </div>
                  <ul className="space-y-1 pl-6">
                    {erroresDelTipo.map((error, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{error.marca}:</span>{" "}
                        {error.mensaje}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
