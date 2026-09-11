import type {
  InformeAsistencia,
  InformeParte,
  InformeParteHoras,
} from "@cuadrilla/shared/domain";
import { i18n } from "../i18n/i18n.svelte";
import {
  docAsistencia,
  docParte,
  docParteHoras,
  type Align,
  type Documento,
} from "./documento";

/**
 * Excel (.xlsx) de los informes de un parte, con el mismo formato que el PDF:
 * cabecera del parte en un bloque gris, cabeceras de columna en negrita
 * centradas y bordes en todas las celdas con datos. Usa `xlsx-js-style` (fork
 * de SheetJS con estilos), cargado bajo demanda.
 */

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BORDE = { style: "thin", color: { rgb: "BFBFBF" } } as const;
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
const GRIS_CAB = "EBEBEB";
const GRIS_CAJA = "F5F5F5";

type Estilo = Record<string, unknown>;

const estiloCabColumna: Estilo = {
  font: { bold: true },
  fill: { fgColor: { rgb: GRIS_CAB } },
  alignment: { horizontal: "center", vertical: "center" },
  border: BORDES,
};
const estiloDato = (align: Align): Estilo => ({
  alignment: { horizontal: align, vertical: "center" },
  border: BORDES,
});
const estiloTotal = (align: Align): Estilo => ({
  font: { bold: true },
  alignment: { horizontal: align, vertical: "center" },
  border: { ...BORDES, top: { style: "medium", color: { rgb: "808080" } } },
});
const estiloCaja: Estilo = {
  fill: { fgColor: { rgb: GRIS_CAJA } },
  border: BORDES,
};

async function libro(documento: Documento, hoja: string): Promise<Blob> {
  const XLSX = (await import("xlsx-js-style")).default;

  const ncols = Math.max(2, ...documento.tablas.map((t) => t.columnas.length));
  const ws: Record<string, unknown> = {};
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] =
    [];
  let R = 0;

  const set = (r: number, c: number, v: string | number, s?: Estilo): void => {
    const ref = XLSX.utils.encode_cell({ r, c });
    ws[ref] = {
      v,
      t: typeof v === "number" ? "n" : "s",
      ...(s ? { s } : {}),
    };
  };

  // Título.
  set(R, 0, documento.titulo, {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "left" },
  });
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: ncols - 1 } });
  R += 2;

  // Cabecera del parte (bloque gris).
  for (const { etiqueta, valor } of documento.cabecera) {
    set(R, 0, etiqueta, { ...estiloCaja, font: { bold: true } });
    set(R, 1, valor, estiloCaja);
    for (let c = 2; c < ncols; c++) set(R, c, "", estiloCaja);
    if (ncols > 2) merges.push({ s: { r: R, c: 1 }, e: { r: R, c: ncols - 1 } });
    R++;
  }
  R++;

  // Tablas.
  for (const t of documento.tablas) {
    set(R, 0, t.titulo, { font: { bold: true, sz: 11 } });
    R++;
    t.columnas.forEach((col, i) => set(R, i, col.titulo, estiloCabColumna));
    R++;
    for (const fila of t.filas) {
      t.columnas.forEach((col, i) => {
        const v = fila[i];
        set(R, i, v == null ? "" : v, estiloDato(col.align));
      });
      R++;
    }
    if (t.total) {
      t.columnas.forEach((col, i) => {
        const v = t.total?.[i];
        set(R, i, v == null ? "" : v, estiloTotal(col.align));
      });
      R++;
    }
    R++;
  }

  // Observaciones (bloque de texto tras las tablas).
  if (documento.observaciones) {
    set(R, 0, i18n.t("compartir.observaciones"), { font: { bold: true, sz: 11 } });
    R++;
    set(R, 0, documento.observaciones, {
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: BORDES,
    });
    for (let c = 1; c < ncols; c++) set(R, c, "", { border: BORDES });
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: ncols - 1 } });
    R += 2;
  }

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(R, 1), c: ncols - 1 },
  });
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 16 },
    { wch: 34 },
    { wch: 16 },
    { wch: 46 },
  ].slice(0, ncols);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  const buffer = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
  }) as ArrayBuffer;
  return new Blob([buffer], { type: MIME });
}

export function asistenciaAXlsx(inf: InformeAsistencia): Promise<Blob> {
  return libro(docAsistencia(inf), i18n.t("compartir.hoja_asistencia"));
}

export function parteAXlsx(inf: InformeParte): Promise<Blob> {
  return libro(docParte(inf), i18n.t("compartir.hoja_parte"));
}

export function parteHorasAXlsx(inf: InformeParteHoras): Promise<Blob> {
  return libro(docParteHoras(inf), i18n.t("compartir.hoja_parte"));
}
