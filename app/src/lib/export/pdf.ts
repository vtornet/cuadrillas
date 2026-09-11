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
  type Columna,
  type Documento,
  type Tabla,
} from "./documento";

/**
 * PDF de los informes de un parte con formato de tabla: cabecera del parte en
 * un recuadro, cabeceras de columna en negrita con fondo gris, y bordes en
 * todas las celdas con datos. jsPDF se carga bajo demanda.
 */

const M = 16; // margen mm
const ANCHO = 210;
const ALTO = 297;
const FIN_X = ANCHO - M;
const ANCHO_UTIL = FIN_X - M;

type Doc = import("jspdf").jsPDF;
interface Cur {
  y: number;
}

const lineaGris = (doc: Doc): Doc => doc.setDrawColor(190, 190, 190);
const fondoCabTabla = (doc: Doc): Doc => doc.setFillColor(235, 235, 235);
const fondoCaja = (doc: Doc): Doc => doc.setFillColor(247, 247, 247);

function saltoSiHaceFalta(doc: Doc, cur: Cur, alto: number): void {
  if (cur.y + alto > ALTO - M) {
    doc.addPage();
    cur.y = M;
  }
}

/** Ancho en mm de cada columna a partir de sus pesos. */
function anchos(cols: Columna[]): number[] {
  const total = cols.reduce((s, c) => s + c.peso, 0);
  return cols.map((c) => (c.peso / total) * ANCHO_UTIL);
}

function xDeCelda(ws: number[], i: number): number {
  let x = M;
  for (let k = 0; k < i; k++) x += ws[k];
  return x;
}

function celdaTexto(
  doc: Doc,
  texto: string,
  x: number,
  w: number,
  y: number,
  align: Columna["align"],
): void {
  const pad = 2;
  const opt =
    align === "center"
      ? { align: "center" as const }
      : align === "right"
        ? { align: "right" as const }
        : { align: "left" as const };
  const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - pad : x + pad;
  doc.text(texto, tx, y, { ...opt, maxWidth: w - pad * 2 });
}

function titulo(doc: Doc, cur: Cur, texto: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(texto, M, cur.y);
  cur.y += 3;
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  doc.line(M, cur.y, FIN_X, cur.y);
  doc.setLineWidth(0.2);
  cur.y += 7;
}

function cajaCabecera(doc: Doc, cur: Cur, campos: Documento["cabecera"]): void {
  const filaAlto = 6.5;
  const alto = campos.length * filaAlto + 4;
  saltoSiHaceFalta(doc, cur, alto + 4);

  fondoCaja(doc);
  lineaGris(doc);
  doc.rect(M, cur.y, ANCHO_UTIL, alto, "FD");

  let y = cur.y + 6;
  doc.setFontSize(10);
  for (const { etiqueta, valor } of campos) {
    doc.setFont("helvetica", "bold");
    doc.text(`${etiqueta}:`, M + 3, y);
    doc.setFont("helvetica", "normal");
    doc.text(valor, M + 42, y, { maxWidth: ANCHO_UTIL - 45 });
    y += filaAlto;
  }
  cur.y += alto + 8;
}

function tabla(doc: Doc, cur: Cur, t: Tabla): void {
  const ws = anchos(t.columnas);
  const filaAlto = 7;

  // Título de la tabla.
  saltoSiHaceFalta(doc, cur, filaAlto * 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t.titulo, M, cur.y);
  cur.y += 4;

  const dibujarCabecera = (): void => {
    fondoCabTabla(doc);
    lineaGris(doc);
    doc.rect(M, cur.y, ANCHO_UTIL, filaAlto, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30);
    t.columnas.forEach((c, i) => {
      celdaTexto(doc, c.titulo, xDeCelda(ws, i), ws[i], cur.y + 4.8, c.align);
    });
    // Líneas verticales de la cabecera.
    for (let i = 1; i < ws.length; i++) {
      const x = xDeCelda(ws, i);
      doc.line(x, cur.y, x, cur.y + filaAlto);
    }
    cur.y += filaAlto;
  };

  dibujarCabecera();

  const dibujarFila = (valores: (string | number)[], negrita: boolean): void => {
    if (cur.y + filaAlto > ALTO - M) {
      doc.addPage();
      cur.y = M;
      dibujarCabecera();
    }
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(negrita ? 20 : 40);
    lineaGris(doc);
    // Recuadro de la fila + verticales.
    doc.rect(M, cur.y, ANCHO_UTIL, filaAlto, "S");
    for (let i = 1; i < ws.length; i++) {
      const x = xDeCelda(ws, i);
      doc.line(x, cur.y, x, cur.y + filaAlto);
    }
    t.columnas.forEach((c, i) => {
      const v = valores[i];
      if (v === "" || v == null) return;
      celdaTexto(doc, String(v), xDeCelda(ws, i), ws[i], cur.y + 4.8, c.align);
    });
    cur.y += filaAlto;
  };

  for (const f of t.filas) dibujarFila(f, false);
  if (t.total) dibujarFila(t.total, true);

  doc.setTextColor(0);
  cur.y += 7;
}

function observaciones(doc: Doc, cur: Cur, texto: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const lineas = doc.splitTextToSize(texto, ANCHO_UTIL - 6);
  const alto = 8 + lineas.length * 5 + 6;
  saltoSiHaceFalta(doc, cur, alto);
  doc.text(i18n.t("compartir.observaciones"), M, cur.y);
  cur.y += 4;
  lineaGris(doc);
  doc.rect(M, cur.y, ANCHO_UTIL, lineas.length * 5 + 6, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(lineas, M + 3, cur.y + 5);
  cur.y += lineas.length * 5 + 6 + 7;
}

function firma(doc: Doc, cur: Cur, pngDataUrl: string, nombre?: string): void {
  saltoSiHaceFalta(doc, cur, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(i18n.t("firma.titulo"), M, cur.y);
  cur.y += 3;
  try {
    lineaGris(doc);
    doc.rect(M, cur.y, 62, 32, "S");
    doc.addImage(pngDataUrl, "PNG", M + 1, cur.y + 1, 60, 30);
    cur.y += 36;
  } catch {
    /* firma con formato inesperado */
  }
  if (nombre) {
    doc.setFont("helvetica", "normal");
    doc.text(nombre, M, cur.y);
  }
}

async function render(documento: Documento): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setLineWidth(0.2);
  const cur: Cur = { y: M };

  titulo(doc, cur, documento.titulo);
  cajaCabecera(doc, cur, documento.cabecera);
  for (const t of documento.tablas) tabla(doc, cur, t);
  if (documento.observaciones) observaciones(doc, cur, documento.observaciones);
  if (documento.firmaPng) firma(doc, cur, documento.firmaPng, documento.firmante);

  return doc.output("blob");
}

export function asistenciaAPdf(inf: InformeAsistencia): Promise<Blob> {
  return render(docAsistencia(inf));
}

export function parteAPdf(inf: InformeParte): Promise<Blob> {
  return render(docParte(inf));
}

export function parteHorasAPdf(inf: InformeParteHoras): Promise<Blob> {
  return render(docParteHoras(inf));
}
