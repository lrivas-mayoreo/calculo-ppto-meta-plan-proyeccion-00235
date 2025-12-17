import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ExcelError {
  marca: string;
  fechaDestino: string;
  empresa: string;
  presupuesto: number;
  error: string;
  tipoError: 'marca_invalida' | 'empresa_invalida' | 'fecha_invalida' | 'presupuesto_invalido' | 'datos_incompletos' | 'sin_datos_ventas';
  sugerencia?: string;
}

interface ExcelErrorDialogProps {
  errors: ExcelError[];
  validCount: number;
  marcasDisponibles: string[];
  empresasDisponibles: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExcelErrorDialog = ({
  errors,
  validCount,
  marcasDisponibles,
  empresasDisponibles,
  isOpen,
  onOpenChange,
}: ExcelErrorDialogProps) => {
  // Agrupar errores por tipo
  const errorsByType = errors.reduce((acc, error) => {
    const type = error.tipoError;
    if (!acc[type]) acc[type] = [];
    acc[type].push(error);
    return acc;
  }, {} as Record<string, ExcelError[]>);

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case 'marca_invalida': return 'Marcas no encontradas';
      case 'empresa_invalida': return 'Empresas no encontradas';
      case 'fecha_invalida': return 'Fechas con formato inválido';
      case 'presupuesto_invalido': return 'Presupuestos inválidos';
      case 'datos_incompletos': return 'Datos incompletos';
      case 'sin_datos_ventas': return 'Sin datos de ventas históricos';
      default: return 'Otros errores';
    }
  };

  const getErrorTypeIcon = (type: string) => {
    switch (type) {
      case 'marca_invalida': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'empresa_invalida': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'fecha_invalida': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'presupuesto_invalido': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'sin_datos_ventas': return <Info className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Resumen de Carga de Excel
          </DialogTitle>
          <DialogDescription>
            Se encontraron {errors.length} registro(s) con errores de {validCount + errors.length} registros totales
          </DialogDescription>
        </DialogHeader>

        {(() => {
          const erroresCriticos = errors.filter(e => e.tipoError !== 'sin_datos_ventas').length;
          const advertencias = errors.filter(e => e.tipoError === 'sin_datos_ventas').length;
          return (
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-md">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{validCount} válidos</span>
              </div>
              {erroresCriticos > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-md">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">{erroresCriticos} con errores</span>
                </div>
              )}
              {advertencias > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">{advertencias} advertencias</span>
                </div>
              )}
            </div>
          );
        })()}

        <ScrollArea className="max-h-[50vh]">
          <Accordion type="multiple" className="w-full" defaultValue={Object.keys(errorsByType)}>
            {Object.entries(errorsByType).map(([type, typeErrors]) => (
              <AccordionItem key={type} value={type}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    {getErrorTypeIcon(type)}
                    <span>{getErrorTypeLabel(type)}</span>
                    <Badge variant="outline" className="ml-2">
                      {typeErrors.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Tabla de errores */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead className="text-right">Presupuesto</TableHead>
                          <TableHead>Detalle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeErrors.slice(0, 10).map((error, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {error.tipoError === 'marca_invalida' ? (
                                <span className="text-destructive">{error.marca}</span>
                              ) : (
                                error.marca
                              )}
                            </TableCell>
                            <TableCell>
                              {error.tipoError === 'fecha_invalida' ? (
                                <span className="text-destructive">{error.fechaDestino}</span>
                              ) : (
                                error.fechaDestino
                              )}
                            </TableCell>
                            <TableCell>
                              {error.tipoError === 'empresa_invalida' ? (
                                <span className="text-destructive">{error.empresa}</span>
                              ) : (
                                error.empresa
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {error.tipoError === 'presupuesto_invalido' ? (
                                <span className="text-destructive">
                                  {isNaN(error.presupuesto) ? 'Inválido' : error.presupuesto}
                                </span>
                              ) : (
                                `$${error.presupuesto.toLocaleString('es-ES')}`
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {error.sugerencia || error.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {typeErrors.length > 10 && (
                      <p className="text-sm text-muted-foreground text-center">
                        ...y {typeErrors.length - 10} más
                      </p>
                    )}

                    {/* Sugerencias específicas por tipo de error */}
                    {type === 'marca_invalida' && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Marcas válidas disponibles:
                        </p>
                        {marcasDisponibles.length === 0 ? (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                              ⚠️ No hay marcas importadas en su cuenta
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Debe importar el maestro de marcas antes de cargar presupuestos. 
                              Vaya a la pestaña "Importar Datos" y cargue un archivo con las marcas.
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {marcasDisponibles.slice(0, 30).map((marca, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {marca}
                              </Badge>
                            ))}
                            {marcasDisponibles.length > 30 && (
                              <Badge variant="outline" className="text-xs">
                                +{marcasDisponibles.length - 30} más
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {type === 'empresa_invalida' && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Empresas válidas disponibles:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {empresasDisponibles.map((empresa, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {empresa}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {type === 'fecha_invalida' && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Formatos de fecha aceptados:
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>YYYY/MM/DD (ej: 2025/12/31)</li>
                          <li>DD/MM/YYYY (ej: 31/12/2025)</li>
                          <li>YYYY-MM-DD (ej: 2025-12-31)</li>
                        </ul>
                      </div>
                    )}

                    {type === 'presupuesto_invalido' && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Formato de presupuesto:
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>Debe ser un número positivo</li>
                          <li>Sin símbolos de moneda ($, €)</li>
                          <li>Separador decimal: punto (.)</li>
                        </ul>
                      </div>
                    )}

                    {type === 'sin_datos_ventas' && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <Info className="h-4 w-4" />
                          Estas marcas están registradas pero no tienen ventas históricas
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>El presupuesto será cargado correctamente</li>
                          <li>La distribución automática no funcionará sin datos históricos</li>
                          <li>Puede asignar el presupuesto manualmente después del cálculo</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
