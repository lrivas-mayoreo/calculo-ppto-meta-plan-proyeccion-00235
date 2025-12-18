import { useState, useMemo } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { cn } from "@/lib/utils";

interface ArticuloData {
  articulo: string;
  ventaReal: number;
  ventaAjustada: number;
  variacion: number;
}

interface ClienteData {
  cliente: string;
  vendedor: string;
  empresa: string;
  subtotal: number;
  articulos: ArticuloData[];
}

interface MarcaResultado {
  marca: string;
  fechaDestino: string;
  empresa: string;
  presupuesto: number;
  promedioVentaMesesReferencia: number;
  porcentajeCambio: number;
  distribucionClientes: ClienteData[];
}

interface BudgetAccordionTableProps {
  resultadosFiltrados: MarcaResultado[];
  totalPresupuesto: number;
}

export const BudgetAccordionTable = ({
  resultadosFiltrados,
  totalPresupuesto,
}: BudgetAccordionTableProps) => {
  const [expandedMarcas, setExpandedMarcas] = useState<Set<string>>(new Set());
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleMarca = (marcaKey: string) => {
    setExpandedMarcas((prev) => {
      const next = new Set(prev);
      if (next.has(marcaKey)) {
        next.delete(marcaKey);
      } else {
        next.add(marcaKey);
      }
      return next;
    });
  };

  const toggleCliente = (clienteKey: string) => {
    setExpandedClientes((prev) => {
      const next = new Set(prev);
      if (next.has(clienteKey)) {
        next.delete(clienteKey);
      } else {
        next.add(clienteKey);
      }
      return next;
    });
  };

  // Filtrar por búsqueda de texto
  const filteredResultados = useMemo(() => {
    if (!searchQuery.trim()) return resultadosFiltrados;

    const query = searchQuery.toLowerCase();
    return resultadosFiltrados
      .map((marca) => ({
        ...marca,
        distribucionClientes: marca.distribucionClientes.filter(
          (cliente) =>
            cliente.cliente.toLowerCase().includes(query) ||
            cliente.vendedor.toLowerCase().includes(query)
        ),
      }))
      .filter(
        (marca) =>
          marca.marca.toLowerCase().includes(query) ||
          marca.distribucionClientes.length > 0
      );
  }, [resultadosFiltrados, searchQuery]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Card className="p-6 shadow-md">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Distribución de Presupuesto por Marca
          </h2>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">${formatCurrency(totalPresupuesto)}</span>
          </p>
        </div>

        {/* Búsqueda rápida */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar marca o cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10"></TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Presupuesto</TableHead>
              <TableHead className="w-40">% del Total</TableHead>
              <TableHead className="text-right">Variación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResultados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No se encontraron resultados
                </TableCell>
              </TableRow>
            ) : (
              filteredResultados.map((marca, marcaIdx) => {
                const marcaKey = `${marca.marca}-${marca.fechaDestino}-${marca.empresa}`;
                const isExpanded = expandedMarcas.has(marcaKey);
                const porcentajeTotal =
                  totalPresupuesto > 0
                    ? (marca.presupuesto / totalPresupuesto) * 100
                    : 0;

                return (
                  <Collapsible key={marcaKey} open={isExpanded} onOpenChange={() => toggleMarca(marcaKey)} asChild>
                    <>
                      {/* Fila principal de la marca */}
                      <TableRow className="group cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <button className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-muted">
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {marca.marca}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {marca.fechaDestino}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {marca.empresa}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${formatCurrency(marca.presupuesto)}
                        </TableCell>
                        <TableCell>
                          <BudgetProgressBar
                            current={marca.presupuesto}
                            total={totalPresupuesto}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            marca.porcentajeCambio >= 0 ? "text-accent" : "text-destructive"
                          )}
                        >
                          {marca.porcentajeCambio >= 0 ? "+" : ""}
                          {marca.porcentajeCambio.toFixed(1)}%
                        </TableCell>
                      </TableRow>

                      {/* Contenido colapsable: clientes */}
                      <CollapsibleContent asChild>
                        <>
                          {marca.distribucionClientes.map((cliente, clienteIdx) => {
                            const clienteKey = `${marcaKey}-${cliente.cliente}-${clienteIdx}`;
                            const isClienteExpanded = expandedClientes.has(clienteKey);

                            return (
                              <Collapsible
                                key={clienteKey}
                                open={isClienteExpanded}
                                onOpenChange={() => toggleCliente(clienteKey)}
                                asChild
                              >
                                <>
                                  {/* Fila del cliente */}
                                  <TableRow className="bg-muted/20 hover:bg-muted/40">
                                    <TableCell></TableCell>
                                    <TableCell colSpan={2} className="pl-8">
                                      <div className="flex items-center gap-2">
                                        {cliente.articulos.length > 0 && (
                                          <CollapsibleTrigger asChild>
                                            <button className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-muted">
                                              <ChevronRight
                                                className={cn(
                                                  "h-3 w-3 text-muted-foreground transition-transform duration-200",
                                                  isClienteExpanded && "rotate-90"
                                                )}
                                              />
                                            </button>
                                          </CollapsibleTrigger>
                                        )}
                                        <span className="text-muted-foreground">↳</span>
                                        <span className="font-medium">{cliente.cliente}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {cliente.vendedor}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ${formatCurrency(cliente.subtotal)}
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>

                                  {/* Detalle de artículos del cliente */}
                                  <CollapsibleContent asChild>
                                    <>
                                      {cliente.articulos.map((articulo, artIdx) => (
                                        <TableRow
                                          key={`${clienteKey}-${artIdx}`}
                                          className="bg-muted/10"
                                        >
                                          <TableCell></TableCell>
                                          <TableCell colSpan={2} className="pl-16">
                                            <span className="text-xs text-muted-foreground">
                                              ↳ {articulo.articulo}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right text-xs text-muted-foreground">
                                            Venta: ${formatCurrency(articulo.ventaReal)}
                                          </TableCell>
                                          <TableCell className="text-right text-xs">
                                            ${formatCurrency(articulo.ventaAjustada)}
                                          </TableCell>
                                          <TableCell></TableCell>
                                          <TableCell
                                            className={cn(
                                              "text-right text-xs",
                                              articulo.variacion >= 0
                                                ? "text-accent"
                                                : "text-destructive"
                                            )}
                                          >
                                            {articulo.variacion >= 0 ? "+" : ""}
                                            {formatCurrency(articulo.variacion)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </>
                                  </CollapsibleContent>
                                </>
                              </Collapsible>
                            );
                          })}
                        </>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
