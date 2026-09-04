import type { Liquidacion } from "@cuadrilla/shared/domain";
import { centimosANumero } from "../money";
import type { ResolutorNombres } from "./csv";

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Libro Excel con dos hojas: "Resumen" (por trabajador, con transporte en
 * columna aparte) y "Detalle" (destajo por trabajador x producto x unidad).
 * SheetJS se carga bajo demanda.
 */
export async function liquidacionAXlsx(
  liq: Liquidacion,
  nombres: ResolutorNombres,
): Promise<Blob> {
  const XLSX = await import("xlsx");

  const resumen: (string | number)[][] = [
    ["Trabajador", "Unidades", "Destajo (EUR)", "Dias", "Transporte (EUR)", "Total (EUR)"],
    ...liq.trabajadores.map((t) => [
      t.name,
      t.totalUnidades,
      centimosANumero(t.importeCentimos),
      t.diasTrabajados,
      centimosANumero(t.transporteCentimos),
      centimosANumero(t.totalCentimos),
    ]),
    [
      "TOTAL",
      liq.totalUnidades,
      centimosANumero(liq.destajoCentimos),
      "",
      centimosANumero(liq.transporteCentimos),
      centimosANumero(liq.totalCentimos),
    ],
  ];

  const detalle: (string | number)[][] = [
    ["Trabajador", "Producto", "Unidad", "Unidades", "Tarifa (EUR/ud)", "Importe (EUR)"],
    ...liq.trabajadores.flatMap((t) =>
      t.lineas.map((l) => [
        t.name,
        nombres.producto(l.productId),
        nombres.unidad(l.unitTypeId),
        l.unidades,
        l.tarifaCentimos !== null
          ? centimosANumero(l.tarifaCentimos)
          : l.sinTarifa
            ? "SIN TARIFA"
            : "",
        centimosANumero(l.importeCentimos),
      ]),
    ),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalle), "Detalle");

  const buffer = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
  return new Blob([buffer], { type: MIME });
}
