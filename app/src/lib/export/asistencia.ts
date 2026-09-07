import type { AsistenciaMensual } from "@cuadrilla/shared/domain";

// BOM UTF-8: Excel abre el CSV con la codificación correcta.
const BOM = "﻿";

/**
 * CSV de la tabla mensual de asistencia: una fila por trabajador con una "X"
 * en cada día asistido, columna de total, y fila final de totales por día.
 * Separador `;`. Sin datos económicos.
 */
export function asistenciaACsv(a: AsistenciaMensual): string {
  const cab = [
    "Trabajador",
    ...a.dias.map((d) => String(d.dia)),
    "Total",
  ];

  const filas = a.filas.map((f) => [
    f.name,
    ...f.presente.map((p) => (p ? "X" : "")),
    String(f.total),
  ]);

  const totales = [
    "Total",
    ...a.totalPorDia.map((n) => String(n)),
    String(a.totalGeneral),
  ];

  const cuerpo = [cab, ...filas, totales]
    .map((fila) => fila.map(escapar).join(";"))
    .join("\r\n");

  return BOM + cuerpo;
}

function escapar(v: string): string {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
