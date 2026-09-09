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

/**
 * Excel (.xlsx) de la tabla mensual de asistencia, con formato: título y
 * cuadrillas arriba, cabecera de días en negrita sobre fondo gris, "X" en las
 * celdas de asistencia (verde), fin de semana sombreado y fila de totales en
 * negrita. Usa `xlsx-js-style` (cargado bajo demanda). Sin datos económicos.
 */
export interface MetaAsistencia {
  titulo: string;
  cuadrillas: string;
}

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BORDE = { style: "thin", color: { rgb: "BFBFBF" } } as const;
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

type Estilo = Record<string, unknown>;

export async function asistenciaAXlsx(
  a: AsistenciaMensual,
  meta: MetaAsistencia,
): Promise<Blob> {
  const XLSX = (await import("xlsx-js-style")).default;

  const ncols = a.dias.length + 2; // Trabajador + días + Total
  const ws: Record<string, unknown> = {};
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] =
    [];
  let R = 0;

  const set = (r: number, c: number, v: string | number, s?: Estilo): void => {
    const ref = XLSX.utils.encode_cell({ r, c });
    ws[ref] = { v, t: typeof v === "number" ? "n" : "s", ...(s ? { s } : {}) };
  };

  const cabColumna = (finde: boolean): Estilo => ({
    font: { bold: true },
    fill: { fgColor: { rgb: finde ? "E4DECF" : "EBEBEB" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDES,
  });
  const celda = (presente: boolean, finde: boolean): Estilo => ({
    fill: presente
      ? { fgColor: { rgb: "C7E3C7" } }
      : finde
        ? { fgColor: { rgb: "F0ECE0" } }
        : {},
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDES,
  });
  const nombreCel: Estilo = {
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDES,
  };
  const totalCel: Estilo = {
    font: { bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    border: { ...BORDES, top: { style: "medium", color: { rgb: "808080" } } },
  };
  const totalNombre: Estilo = {
    font: { bold: true },
    alignment: { horizontal: "left", vertical: "center" },
    border: { ...BORDES, top: { style: "medium", color: { rgb: "808080" } } },
  };

  // Título + cuadrillas.
  set(R, 0, meta.titulo, { font: { bold: true, sz: 14 } });
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: ncols - 1 } });
  R++;
  if (meta.cuadrillas) {
    set(R, 0, meta.cuadrillas, { font: { italic: true } });
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: ncols - 1 } });
    R++;
  }
  R++;

  // Cabecera.
  set(R, 0, "Trabajador", cabColumna(false));
  a.dias.forEach((d, i) => set(R, i + 1, d.dia, cabColumna(d.finDeSemana)));
  set(R, ncols - 1, "Total", cabColumna(false));
  R++;

  // Filas de trabajadores.
  for (const f of a.filas) {
    set(R, 0, f.name, nombreCel);
    f.presente.forEach((p, i) =>
      set(R, i + 1, p ? "X" : "", celda(p, a.dias[i].finDeSemana)),
    );
    set(R, ncols - 1, f.total, {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDES,
    });
    R++;
  }

  // Totales por día.
  set(R, 0, "Total", totalNombre);
  a.totalPorDia.forEach((n, i) => set(R, i + 1, n || "", totalCel));
  set(R, ncols - 1, a.totalGeneral, totalCel);
  R++;

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(R, 1), c: ncols - 1 },
  });
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 22 },
    ...a.dias.map(() => ({ wch: 3.5 })),
    { wch: 7 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
  const buffer = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
  }) as ArrayBuffer;
  return new Blob([buffer], { type: MIME });
}
