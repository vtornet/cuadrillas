import type {
  InformeAsistencia,
  InformeParte,
} from "@cuadrilla/shared/domain";
import { fechaES } from "@cuadrilla/shared/domain";
import { i18n } from "../i18n/i18n.svelte";

/**
 * Generación de PDF de los informes de un parte. jsPDF se carga bajo demanda
 * (import dinámico), igual que SheetJS. Trazado manual sencillo, sin
 * jspdf-autotable.
 */

const MARGEN = 16; // mm
const ANCHO = 210; // A4
const ALTO = 297;
const FIN_X = ANCHO - MARGEN;

type Doc = import("jspdf").jsPDF;

interface Cursor {
  y: number;
}

function nuevaPagina(doc: Doc, cur: Cursor): void {
  doc.addPage();
  cur.y = MARGEN;
}

function asegurar(doc: Doc, cur: Cursor, alto: number): void {
  if (cur.y + alto > ALTO - MARGEN) nuevaPagina(doc, cur);
}

function titulo(doc: Doc, cur: Cursor, texto: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(texto, MARGEN, cur.y);
  cur.y += 8;
}

function cabecera(
  doc: Doc,
  cur: Cursor,
  c: InformeParte["cabecera"],
): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lineas = [
    `${i18n.t("jornada.cuadrilla")}: ${c.cuadrilla}`,
    ...(c.finca ? [`${i18n.t("jornada.finca").replace(/ \(.*\)$/, "")}: ${c.finca}`] : []),
    `${i18n.t("jornada.fecha")}: ${fechaES(c.fecha)}`,
    `${i18n.t("jornada.producto")}: ${c.producto}`,
    ...(c.unidad ? [`${i18n.t("jornada.unidad")}: ${c.unidad}`] : []),
    ...(c.firmante ? [`${i18n.t("cabecera.firma_pdf")}: ${c.firmante}`] : []),
  ];
  for (const l of lineas) {
    doc.text(l, MARGEN, cur.y);
    cur.y += 5;
  }
  cur.y += 2;
  doc.setDrawColor(180);
  doc.line(MARGEN, cur.y, FIN_X, cur.y);
  cur.y += 6;
}

function seccion(doc: Doc, cur: Cursor, texto: string): void {
  asegurar(doc, cur, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(texto, MARGEN, cur.y);
  cur.y += 6;
}

/** Fila de dos columnas: texto a la izquierda, valor alineado a la derecha. */
function fila(doc: Doc, cur: Cursor, izq: string, der = ""): void {
  asegurar(doc, cur, 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(izq, MARGEN, cur.y, { maxWidth: FIN_X - MARGEN - 25 });
  if (der) doc.text(der, FIN_X, cur.y, { align: "right" });
  cur.y += 6;
}

function totalLinea(doc: Doc, cur: Cursor, etiqueta: string, valor: string): void {
  asegurar(doc, cur, 10);
  cur.y += 1;
  doc.setDrawColor(120);
  doc.line(MARGEN, cur.y, FIN_X, cur.y);
  cur.y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(etiqueta, MARGEN, cur.y);
  doc.text(valor, FIN_X, cur.y, { align: "right" });
  cur.y += 6;
}

async function crearDoc(): Promise<Doc> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "mm", format: "a4" });
}

export async function asistenciaAPdf(inf: InformeAsistencia): Promise<Blob> {
  const doc = await crearDoc();
  const cur: Cursor = { y: MARGEN };

  titulo(doc, cur, i18n.t("compartir.pdf_titulo_asistencia"));
  cabecera(doc, cur, inf.cabecera);

  seccion(doc, cur, `${i18n.t("compartir.recolectores")} (${inf.recolectores.length})`);
  inf.recolectores.forEach((n, i) => fila(doc, cur, `${i + 1}. ${n}`));

  if (inf.auxiliares.length > 0) {
    cur.y += 2;
    seccion(doc, cur, `${i18n.t("auxiliar.seccion")} (${inf.auxiliares.length})`);
    inf.auxiliares.forEach((n, i) => fila(doc, cur, `${i + 1}. ${n}`));
  }

  for (const g of inf.grupos) {
    cur.y += 2;
    seccion(doc, cur, `${g.nombre} (${g.miembros.length})`);
    g.miembros.forEach((n) => fila(doc, cur, n));
  }

  return doc.output("blob");
}

export async function parteAPdf(inf: InformeParte): Promise<Blob> {
  const doc = await crearDoc();
  const cur: Cursor = { y: MARGEN };
  const ud = inf.cabecera.unidad || i18n.t("compartir.unidades");

  titulo(doc, cur, i18n.t("compartir.pdf_titulo_parte"));
  cabecera(doc, cur, inf.cabecera);

  if (inf.grupos.length > 0) {
    seccion(doc, cur, i18n.t("gestion.grupos"));
    for (const g of inf.grupos) {
      fila(doc, cur, g.nombre, `${g.unidades} ${ud}`);
      if (g.miembros.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(110);
        fila(doc, cur, `   ${g.miembros.join(", ")}`);
        doc.setTextColor(0);
      }
    }
  } else {
    seccion(doc, cur, `${i18n.t("compartir.recolectores")} (${inf.recolectores.length})`);
    for (const r of inf.recolectores) {
      fila(doc, cur, r.nombre, `${r.unidades} ${ud}`);
    }
  }

  if (inf.auxiliares.length > 0) {
    cur.y += 2;
    seccion(doc, cur, `${i18n.t("auxiliar.seccion")} (${inf.auxiliares.length})`);
    for (const a of inf.auxiliares) {
      const detalle = [
        a.tarea,
        a.horas != null ? i18n.t("auxiliar.n_horas", { n: a.horas }) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      fila(doc, cur, a.nombre, detalle);
    }
  }

  totalLinea(
    doc,
    cur,
    i18n.t("registro.total_jornada"),
    `${inf.totalUnidades} ${ud}`,
  );

  if (inf.cabecera.firmaPng) {
    cur.y += 6;
    asegurar(doc, cur, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(i18n.t("firma.titulo"), MARGEN, cur.y);
    cur.y += 3;
    try {
      doc.addImage(inf.cabecera.firmaPng, "PNG", MARGEN, cur.y, 60, 30);
      cur.y += 32;
    } catch {
      /* firma con formato inesperado: se omite */
    }
    if (inf.cabecera.firmante) {
      doc.setFont("helvetica", "normal");
      doc.text(inf.cabecera.firmante, MARGEN, cur.y);
    }
  }

  return doc.output("blob");
}
