import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Upload, X, Download, Eye, Info, Settings, Check, AlertTriangle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { MarcaPresupuesto } from "@/pages/Index";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { parseDateFromExcel, formatDateToYYYYMMDD, detectDateFormat } from "@/lib/dateUtils";
import { SuggestedBudget } from "@/components/SuggestedBudget";
import { ExcelErrorDialog } from "@/components/ExcelErrorDialog";

interface BudgetFormProps {
  onCalculate: (marcasPresupuesto: MarcaPresupuesto[], mesesReferencia: string[]) => void;
  mockData: {
    marcas: string[];
    marcasConCodigo?: Array<{ codigo: string; nombre: string }>;
    empresas: string[];
    articulos: Record<string, string[]>;
  };
  mesesDisponibles: string[];
  onMarcasPresupuestoLoad: (marcas: MarcaPresupuesto[]) => void;
  historicalBudgets?: Array<{ marca: string; empresa: string; presupuesto: number; fechaDestino: string }>;
  ventasData: Array<{
    mesAnio: string;
    marca: string;
    cliente: string;
    articulo: string;
    vendedor: string;
    empresa: string;
    venta: number;
  }>;
  vendorAdjustments?: Record<
    string,
    { amount: number; percentage: number; fixedField: "amount" | "percentage" | null }
  >;
  brandAdjustments?: Record<string, number>;
  presupuestoTotal?: number;
}

export const BudgetForm = ({
  onCalculate,
  mockData,
  mesesDisponibles,
  onMarcasPresupuestoLoad,
  historicalBudgets = [],
  ventasData,
  vendorAdjustments = {},
  brandAdjustments = {},
  presupuestoTotal = 0,
}: BudgetFormProps) => {
  const [mesInicio, setMesInicio] = useState<string>("");
  const [mesFin, setMesFin] = useState<string>("");
  const [mesesReferencia, setMesesReferencia] = useState<string[]>([]);
  const [marcasPresupuesto, setMarcasPresupuesto] = useState<MarcaPresupuesto[]>([]);
  const [marcasConError, setMarcasConError] = useState<
    Array<{
      marca: string;
      fechaDestino: string;
      empresa: string;
      presupuesto: number;
      error: string;
      tipoError:
        | "marca_invalida"
        | "empresa_invalida"
        | "fecha_invalida"
        | "presupuesto_invalido"
        | "datos_incompletos"
        | "sin_datos_ventas";
      sugerencia?: string;
    }>
  >([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [showMarcasCargadas, setShowMarcasCargadas] = useState(false);
  const [showMarcasError, setShowMarcasError] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [dateFormatPreview, setDateFormatPreview] = useState<string>("");

  // Calculate meses referencia from start/end selection
  useEffect(() => {
    if (!mesInicio && !mesFin) {
      setMesesReferencia([]);
      return;
    }

    // If only one is set, use same value for both
    const inicio = mesInicio || mesFin;
    const fin = mesFin || mesInicio;

    const startIdx = mesesDisponibles.indexOf(inicio);
    const endIdx = mesesDisponibles.indexOf(fin);

    if (startIdx === -1 || endIdx === -1) {
      setMesesReferencia([]);
      return;
    }

    // mesesDisponibles is ordered from newest to oldest, so we need to handle range correctly
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    const selectedMeses = mesesDisponibles.slice(minIdx, maxIdx + 1);
    setMesesReferencia(selectedMeses);
  }, [mesInicio, mesFin, mesesDisponibles]);

  const handleMesInicioChange = (value: string) => {
    setMesInicio(value);
    // Auto-complete mesFin if empty
    if (!mesFin) {
      setMesFin(value);
    }
  };

  const handleMesFinChange = (value: string) => {
    setMesFin(value);
    // Auto-complete mesInicio if empty
    if (!mesInicio) {
      setMesInicio(value);
    }
  };

  const handleMesToggle = (mesAnio: string) => {
    setMesesReferencia((prev) => (prev.includes(mesAnio) ? prev.filter((m) => m !== mesAnio) : [...prev, mesAnio]));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📁 Excel upload - Marcas disponibles:", mockData.marcas.length, mockData.marcas.slice(0, 5));

    if (mockData.marcas.length === 0) {
      toast.error("Espere a que se carguen las marcas de la base de datos antes de cargar el Excel");
      e.target.value = "";
      return;
    }

    setExcelFileName(file.name);
    toast.info("Procesando archivo Excel...");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Validar estructura del Excel
        if (jsonData.length === 0) {
          toast.error("El archivo Excel está vacío");
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        // Validar que tenga las columnas necesarias (Marca, Mes y Presupuesto)
        const firstRow = jsonData[0];
        if (!firstRow.Marca && !firstRow.marca) {
          toast.error("El archivo Excel debe tener una columna 'Marca'");
          setExcelFileName("");
          e.target.value = "";
          return;
        }
        if (!firstRow.Fecha && !firstRow.fecha) {
          toast.error("El archivo Excel debe tener una columna 'Fecha' (formato: YYYY/MM/DD)");
          setExcelFileName("");
          e.target.value = "";
          return;
        }
        if (!firstRow.Empresa && !firstRow.empresa) {
          toast.error("El archivo Excel debe tener una columna 'Empresa'");
          setExcelFileName("");
          e.target.value = "";
          return;
        }
        if (!firstRow.Presupuesto && !firstRow.presupuesto) {
          toast.error("El archivo Excel debe tener una columna 'Presupuesto'");
          setExcelFileName("");
          e.target.value = "";
          return;
        }

        // Parsear datos y validar formato de fecha
        const marcasFromExcel: MarcaPresupuesto[] = [];
        const errores: Array<{
          marca: string;
          fechaDestino: string;
          empresa: string;
          presupuesto: number;
          error: string;
          tipoError:
            | "marca_invalida"
            | "empresa_invalida"
            | "fecha_invalida"
            | "presupuesto_invalido"
            | "datos_incompletos"
            | "sin_datos_ventas";
          sugerencia?: string;
        }> = [];
        let detectedFormat = "";

        jsonData.forEach((row, index) => {
          const marca = row.Marca || row.marca;
          const fechaRaw = (row.Fecha || row.fecha)?.toString().trim() || "";
          const empresa = row.Empresa || row.empresa;
          const presupuestoRaw = row.Presupuesto || row.presupuesto;
          const presupuesto = parseFloat(presupuestoRaw);

          // Detect date format from first valid row
          if (index === 0 && fechaRaw) {
            detectedFormat = detectDateFormat(fechaRaw);
            setDateFormatPreview(detectedFormat);
          }

          // Parse date dynamically
          const parsedDate = parseDateFromExcel(fechaRaw);
          const fechaDestino = parsedDate ? formatDateToYYYYMMDD(parsedDate) : "";

          // Validar presupuesto
          if (isNaN(presupuesto) || presupuesto <= 0) {
            if (marca) {
              errores.push({
                marca,
                fechaDestino: fechaRaw || "Sin fecha",
                empresa: empresa || "Sin empresa",
                presupuesto: presupuesto || 0,
                error: `Presupuesto inválido: "${presupuestoRaw}"`,
                tipoError: "presupuesto_invalido",
                sugerencia: "El presupuesto debe ser un número positivo sin símbolos",
              });
            }
            return;
          }

          // Validar fecha
          if (!fechaDestino) {
            if (marca) {
              errores.push({
                marca,
                fechaDestino: fechaRaw || "Sin fecha",
                empresa: empresa || "Sin empresa",
                presupuesto: presupuesto || 0,
                error: `Formato de fecha inválido: "${fechaRaw}"`,
                tipoError: "fecha_invalida",
                sugerencia: "Use formato YYYY/MM/DD, DD/MM/YYYY o YYYY-MM-DD",
              });
            }
            return;
          }

          // Validar datos completos
          if (!marca || !empresa) {
            errores.push({
              marca: marca || "Sin marca",
              fechaDestino,
              empresa: empresa || "Sin empresa",
              presupuesto,
              error: "Datos incompletos",
              tipoError: "datos_incompletos",
              sugerencia: "Todas las columnas deben tener valores",
            });
            return;
          }

          // Validar que la marca exista en el maestro (check both codigo and nombre, case-insensitive)
          let marcaEncontrada = mockData.marcas.find((m) => m.toLowerCase().trim() === marca.toLowerCase().trim());

          // Also check by codigo if marcasConCodigo is available
          if (!marcaEncontrada && mockData.marcasConCodigo) {
            const marcaPorCodigo = mockData.marcasConCodigo.find(
              (m) => m.codigo.toLowerCase().trim() === marca.toLowerCase().trim(),
            );
            if (marcaPorCodigo) {
              marcaEncontrada = marcaPorCodigo.nombre;
            }
          }

          if (!marcaEncontrada) {
            console.log("❌ Marca no encontrada:", marca, "Disponibles:", mockData.marcas.slice(0, 5));
            errores.push({
              marca,
              fechaDestino,
              empresa,
              presupuesto,
              error: `Marca "${marca}" no existe en el maestro`,
              tipoError: "marca_invalida",
              sugerencia: `Verifique que la marca esté registrada.Ejemplo: ${mockData.marcas[0] || "N/A"} `,
            });
            return;
          }

          // Validar que la empresa exista en el maestro (case-insensitive)
          const empresaEncontrada = mockData.empresas.find(
            (e) => e.toLowerCase().trim() === empresa.toLowerCase().trim(),
          );
          if (!empresaEncontrada) {
            errores.push({
              marca,
              fechaDestino,
              empresa,
              presupuesto,
              error: `Empresa "${empresa}" no existe en el sistema`,
              tipoError: "empresa_invalida",
              sugerencia: `Empresas válidas: ${mockData.empresas.join(", ")} `,
            });
            return;
          }

          // Verificar si la marca tiene datos de ventas en los meses de referencia
          const ventasDeMarca = ventasData.filter(
            (v) =>
              v.marca.toLowerCase().trim() === marcaEncontrada!.toLowerCase().trim() &&
              v.empresa.toLowerCase().trim() === empresaEncontrada.toLowerCase().trim(),
          );

          if (ventasDeMarca.length === 0) {
            errores.push({
              marca: marcaEncontrada!,
              fechaDestino,
              empresa: empresaEncontrada,
              presupuesto,
              error: `Sin datos de ventas históricos`,
              tipoError: "sin_datos_ventas",
              sugerencia:
                "No se encontraron ventas para esta marca/empresa en los meses disponibles. El presupuesto se cargará pero no se podrá distribuir automáticamente.",
            });
          }

          marcasFromExcel.push({
            marca: marcaEncontrada, // Usar nombre exacto del sistema
            fechaDestino,
            empresa: empresaEncontrada, // Usar nombre exacto del sistema
            presupuesto,
          });
        });

        // Guardar marcas con errores
        setMarcasConError(errores);

        if (marcasFromExcel.length === 0 && errores.length > 0) {
          toast.error("No se encontraron datos válidos en el archivo. Haga clic en 'Ver errores' para más detalles.");
          setShowErrorDialog(true);
          setExcelFileName(file.name); // Mantener el nombre para mostrar errores
          e.target.value = "";
          return;
        }

        setMarcasPresupuesto(marcasFromExcel);
        onMarcasPresupuestoLoad(marcasFromExcel);

        if (errores.length > 0) {
          toast.warning(
            `Archivo cargado con ${marcasFromExcel.length} marca(s) válida(s) y ${errores.length} error(es).Haga clic en el icono ⚠️ para ver detalles.`,
          );
          setShowErrorDialog(true);
        } else {
          toast.success(`${marcasFromExcel.length} marcas cargadas(Formato: ${detectedFormat})`);
        }
      } catch (error) {
        toast.error("Error al procesar el archivo Excel");
        setExcelFileName("");
        e.target.value = "";
        console.error(error);
      }
    };

    reader.onerror = () => {
      toast.error("Error al leer el archivo");
      setExcelFileName("");
      e.target.value = "";
    };

    reader.readAsBinaryString(file);
  };

  const handleRemoveExcel = () => {
    setMarcasPresupuesto([]);
    setMarcasConError([]);
    setExcelFileName("");
    onMarcasPresupuestoLoad([]);
    const fileInput = document.getElementById("excel-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    setShowMarcasCargadas(false);
    setShowMarcasError(false);
    setShowErrorDialog(false);
    toast.info("Archivo Excel removido");
  };

  const handleDownloadTemplate = () => {
    // Crear array con las marcas disponibles y columnas de Fecha, Empresa y Presupuesto con ejemplos
    const templateData = mockData.marcas.map((marca, index) => ({
      Marca: marca,
      Fecha: index === 0 ? "2025/12/31" : "",
      Empresa: index === 0 ? mockData.empresas[0] : "",
      Presupuesto: index === 0 ? "100000" : "",
    }));

    // Crear libro de Excel
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Marcas");

    // Descargar archivo
    XLSX.writeFile(workbook, "Template_Marcas_Presupuesto.xlsx");
    toast.success("Template Excel descargado correctamente");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mesesReferencia.length === 0) {
      toast.error("Seleccione al menos un mes de referencia");
      return;
    }

    if (marcasPresupuesto.length === 0) {
      toast.error("Por favor cargue un archivo Excel con marcas, fechas, empresas y presupuestos");
      return;
    }

    try {
      onCalculate(marcasPresupuesto, mesesReferencia);
      toast.success(`Cálculo realizado exitosamente para ${marcasPresupuesto.length} marca(s)`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Parámetros de Cálculo</h2>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="excel-upload">Cargar Excel con Marcas y Presupuestos *</Label>
          <div className="flex gap-2">
            <SuggestedBudget
              historicalData={historicalBudgets}
              marcasDisponibles={mockData.marcas}
              empresasDisponibles={mockData.empresas}
              mesesDisponibles={mesesDisponibles}
              ventasData={ventasData}
              onApplySuggestion={(marcas, mesesReferencia) => {
                console.log("🎯 Aplicando presupuesto sugerido:", {
                  marcasCount: marcas.length,
                  mesesReferenciaCount: mesesReferencia.length,
                });
                setMarcasPresupuesto(marcas);
                setMesesReferencia(mesesReferencia);
                onMarcasPresupuestoLoad(marcas);
                // Automatically trigger calculation with the suggested budget
                setTimeout(() => {
                  console.log("🔄 Iniciando cálculo automático de distribución...");
                  onCalculate(marcas, mesesReferencia);
                  toast.success("Distribución calculada automáticamente por marca, vendedor, cliente y artículo");
                }, 100);
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Descargar Template
            </Button>
          </div>
        </div>
        {excelFileName ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
              <div className="flex-1 truncate text-sm">
                <span className="font-medium">{excelFileName}</span>
                <span className="ml-2 text-muted-foreground">
                  ({marcasPresupuesto.length} marca{marcasPresupuesto.length !== 1 ? "s" : ""})
                </span>
                {marcasConError.length > 0 && (
                  <span className="ml-2 text-destructive">
                    ({marcasConError.length} error{marcasConError.length !== 1 ? "es" : ""})
                  </span>
                )}
              </div>
              {marcasConError.length > 0 && (
                <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-destructive">
                        {marcasConError.length} marca{marcasConError.length !== 1 ? "s" : ""} con error
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Las siguientes marcas no tienen historial de ventas en los meses seleccionados:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {marcasConError.slice(0, 5).map((error, idx) => (
                          <Badge key={idx} variant="destructive" className="text-xs">
                            {error.marca}
                          </Badge>
                        ))}
                        {marcasConError.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{marcasConError.length - 5} más
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowErrorDialog(true)}
                        className="mt-2"
                      >
                        Ver detalles completos
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowMarcasCargadas(!showMarcasCargadas)}
                className="h-8 w-8"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleRemoveExcel} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {marcasConError.length > 0 && (
              <Collapsible open={showMarcasError} onOpenChange={setShowMarcasError}>
                <CollapsibleContent>
                  <div className="rounded-md border border-destructive bg-destructive/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead className="text-right">Presupuesto</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marcasConError.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.marca}</TableCell>
                            <TableCell>{item.fechaDestino}</TableCell>
                            <TableCell>{item.empresa}</TableCell>
                            <TableCell className="text-right">
                              $
                              {item.presupuesto.toLocaleString("es-ES", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="text-destructive">{item.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Collapsible open={showMarcasCargadas} onOpenChange={setShowMarcasCargadas}>
              <CollapsibleContent>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-right">Presupuesto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marcasPresupuesto.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.marca}</TableCell>
                          <TableCell>{item.fechaDestino}</TableCell>
                          <TableCell>{item.empresa}</TableCell>
                          <TableCell className="text-right">
                            $
                            {item.presupuesto.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="cursor-pointer"
            />
            <Button type="button" variant="outline" size="icon">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Formato: Columnas "Marca", "Fecha" (DD/MM/YYYY o YYYY/MM/DD), "Empresa" y "Presupuesto"
        </p>
      </div>

      {dateFormatPreview && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Info className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Formato detectado: <Badge variant="outline">{dateFormatPreview}</Badge>
          </span>
        </div>
      )}

      {/* === Meses de Referencia (2 selects: inicio y fin) === */}
      <div className="space-y-3">
        <Label>Meses de Referencia *</Label>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Mes Inicio</Label>
            <Select value={mesInicio} onValueChange={handleMesInicioChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione mes inicio" />
              </SelectTrigger>
              <SelectContent>
                {mesesDisponibles.map((mesAnio) => (
                  <SelectItem key={mesAnio} value={mesAnio}>
                    {mesAnio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Mes Fin</Label>
            <Select value={mesFin} onValueChange={handleMesFinChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione mes fin" />
              </SelectTrigger>
              <SelectContent>
                {mesesDisponibles.map((mesAnio) => (
                  <SelectItem key={mesAnio} value={mesAnio}>
                    {mesAnio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {mesesReferencia.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rango seleccionado: {mesesReferencia.length} mes(es)</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMesInicio("");
                setMesFin("");
              }}
            >
              Limpiar
            </Button>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full">
        <Calculator className="mr-2 h-4 w-4" />
        Calcular Presupuesto
      </Button>

      {/* Sección de Ajustes Configurables - Ahora se muestra solo en el diálogo */}
      {false && (Object.keys(vendorAdjustments).length > 0 || Object.keys(brandAdjustments).length > 0) && (
        <div className="mt-6 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Ajustes Configurables</h3>
          </div>

          {Object.keys(vendorAdjustments).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Ajustes de Vendedores:</h4>
              <div className="rounded-md border border-border bg-card p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Valor Ajustado</TableHead>
                      <TableHead className="text-right">Presupuesto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(vendorAdjustments)
                      .map(([vendor, adj]) => {
                        // Validar que adj existe y tiene las propiedades necesarias
                        if (!adj || typeof adj.percentage === "undefined" || typeof adj.amount === "undefined") {
                          return null;
                        }

                        return (
                          <TableRow key={vendor}>
                            <TableCell className="font-medium">
                              {vendor}
                              {adj.fixedField && <span className="ml-2 text-xs text-primary">(Ajustado)</span>}
                            </TableCell>
                            <TableCell className="text-right">{adj.percentage.toFixed(2)}%</TableCell>
                            <TableCell className="text-right">
                              ${adj.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        );
                      })
                      .filter(Boolean)}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {Object.keys(brandAdjustments).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Ajustes de Marcas:</h4>
              <div className="rounded-md border border-border bg-card p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Ajuste Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(brandAdjustments).map(([marca, ajuste]) => (
                      <TableRow key={marca}>
                        <TableCell className="font-medium">{marca}</TableCell>
                        <TableCell className="text-right">
                          ${ajuste.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diálogo de errores detallado */}
      <ExcelErrorDialog
        errors={marcasConError}
        validCount={marcasPresupuesto.length}
        marcasDisponibles={mockData.marcas}
        empresasDisponibles={mockData.empresas}
        isOpen={showErrorDialog}
        onOpenChange={setShowErrorDialog}
      />
    </form>
  );
};
