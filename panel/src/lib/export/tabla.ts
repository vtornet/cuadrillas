/**
 * Exportación genérica de una tabla (cabeceras + filas + fila de total
 * opcional) a CSV o Excel con estilo. `xlsx-js-style` se carga bajo demanda.
 */

export type Celda = string | number;

export interface Tabla {
  titulo: string;
  /** Líneas de contexto sobre la tabla (periodo, cuadrilla…). */
  meta?: string[];
  cabeceras: string[];
  filas: Celda[][];
  /** Fila de totales (misma anchura que `cabeceras`), en negrita. */
  total?: Celda[];
}

const BOM = "﻿";

export function tablaACsv(t: Tabla): Blob {
  const esc = (v: Celda): string => {
    const s = String(v ?? "");
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas: string[] = [t.titulo];
  for (const m of t.meta ?? []) lineas.push(m);
  lineas.push("");
  lineas.push(t.cabeceras.map(esc).join(";"));
  for (const f of t.filas) lineas.push(f.map(esc).join(";"));
  if (t.total) lineas.push(t.total.map(esc).join(";"));
  return new Blob([BOM + lineas.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
}

const BORDE = { style: "thin", color: { rgb: "BFBFBF" } } as const;
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

export async function tablaAXlsx(t: Tabla): Promise<Blob> {
  const XLSX = (await import("xlsx-js-style")).default;
  const ws: Record<string, unknown> = {};
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] =
    [];
  const ncols = t.cabeceras.length;
  let R = 0;

  const set = (
    r: number,
    c: number,
    v: Celda,
    s?: Record<string, unknown>,
  ): void => {
    ws[XLSX.utils.encode_cell({ r, c })] = {
      v,
      t: typeof v === "number" ? "n" : "s",
      ...(s ? { s } : {}),
    };
  };

  set(R, 0, t.titulo, { font: { bold: true, sz: 14 } });
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: ncols - 1 } });
  R++;
  for (const m of t.meta ?? []) {
    set(R, 0, m, { font: { italic: true } });
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: ncols - 1 } });
    R++;
  }
  R++;

  t.cabeceras.forEach((h, c) =>
    set(R, c, h, {
      font: { bold: true },
      fill: { fgColor: { rgb: "EBEBEB" } },
      alignment: { horizontal: "center" },
      border: BORDES,
    }),
  );
  R++;

  for (const fila of t.filas) {
    fila.forEach((v, c) =>
      set(R, c, v ?? "", {
        alignment: { horizontal: typeof v === "number" ? "right" : "left" },
        border: BORDES,
      }),
    );
    R++;
  }

  if (t.total) {
    t.total.forEach((v, c) =>
      set(R, c, v ?? "", {
        font: { bold: true },
        alignment: { horizontal: typeof v === "number" ? "right" : "left" },
        border: { ...BORDES, top: { style: "medium", color: { rgb: "808080" } } },
      }),
    );
    R++;
  }

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(R, 1), c: ncols - 1 },
  });
  ws["!merges"] = merges;
  ws["!cols"] = t.cabeceras.map((h, i) => ({ wch: i === 0 ? 24 : Math.max(10, h.length + 2) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja");
  const buf = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
  }) as ArrayBuffer;
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function tablaAPdf(t: Tabla): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14;
  const W = 210 - M * 2;
  let y = M + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(t.titulo, M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const m of t.meta ?? []) {
    doc.text(m, M, y);
    y += 4.5;
  }
  y += 3;

  const ncols = t.cabeceras.length;
  const w0 = W * 0.34;
  const wr = (W - w0) / (ncols - 1);
  const xcol = (c: number): number => M + (c === 0 ? 0 : w0 + (c - 1) * wr);
  const wcol = (c: number): number => (c === 0 ? w0 : wr);
  const filaAlto = 7;

  const celda = (c: number, v: Celda, yy: number): void => {
    const s = String(v ?? "");
    const derecha = typeof v === "number" || c > 0;
    doc.text(
      s,
      derecha ? xcol(c) + wcol(c) - 2 : xcol(c) + 2,
      yy + 4.7,
      derecha ? { align: "right" } : {},
    );
  };
  const marco = (yy: number): void => {
    doc.setDrawColor(190);
    doc.rect(M, yy, W, filaAlto, "S");
    for (let c = 1; c < ncols; c++) doc.line(xcol(c), yy, xcol(c), yy + filaAlto);
  };

  const nueva = (): void => {
    doc.setFillColor(235, 235, 235);
    doc.setDrawColor(190);
    doc.rect(M, y, W, filaAlto, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    t.cabeceras.forEach((h, c) => celda(c, h, y));
    for (let c = 1; c < ncols; c++) doc.line(xcol(c), y, xcol(c), y + filaAlto);
    y += filaAlto;
    doc.setFont("helvetica", "normal");
  };
  nueva();

  for (const fila of t.filas) {
    if (y + filaAlto > 297 - M) {
      doc.addPage();
      y = M;
      nueva();
    }
    marco(y);
    fila.forEach((v, c) => celda(c, v, y));
    y += filaAlto;
  }
  if (t.total) {
    doc.setFont("helvetica", "bold");
    doc.setDrawColor(120);
    doc.setLineWidth(0.5);
    doc.rect(M, y, W, filaAlto, "S");
    doc.setLineWidth(0.2);
    for (let c = 1; c < ncols; c++) doc.line(xcol(c), y, xcol(c), y + filaAlto);
    t.total.forEach((v, c) => celda(c, v, y));
  }

  return doc.output("blob");
}
