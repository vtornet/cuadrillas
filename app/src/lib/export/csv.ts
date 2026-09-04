import type { Liquidacion } from "@cuadrilla/shared/domain";
import { centimosADecimal } from "../money";

export interface ResolutorNombres {
  producto: (id: string) => string;
  unidad: (id: string) => string;
}

// BOM UTF-8: Excel abre el CSV con la codificacion correcta.
const BOM = "﻿";

/**
 * CSV resumen por trabajador, con el transporte en su propia columna y una fila
 * TOTAL. Separador `;` y coma decimal (Excel en espanol).
 */
export function liquidacionACsv(liq: Liquidacion): string {
  const filas: string[][] = [
    [
      "Trabajador",
      "Unidades",
      "Destajo EUR",
      "Dias",
      "Transporte EUR",
      "Total EUR",
    ],
  ];

  for (const t of liq.trabajadores) {
    filas.push([
      t.name,
      String(t.totalUnidades),
      centimosADecimal(t.importeCentimos),
      String(t.diasTrabajados),
      centimosADecimal(t.transporteCentimos),
      centimosADecimal(t.totalCentimos),
    ]);
  }

  filas.push([]);
  filas.push([
    "TOTAL",
    String(liq.totalUnidades),
    centimosADecimal(liq.destajoCentimos),
    "",
    centimosADecimal(liq.transporteCentimos),
    centimosADecimal(liq.totalCentimos),
  ]);

  const cuerpo = filas.map((f) => f.map(escapar).join(";")).join("\r\n");
  return BOM + cuerpo;
}

function escapar(v: string): string {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
