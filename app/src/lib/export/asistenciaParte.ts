import type { InformeAsistencia } from "@cuadrilla/shared/domain";
import { fechaES } from "@cuadrilla/shared/domain";

/**
 * Texto plano de la asistencia de un parte, para enviar por WhatsApp / email /
 * compartir. Sin importes. El PDF y el Excel se generan en `pdf.ts` / `xlsx.ts`.
 */
export function textoAsistenciaParte(inf: InformeAsistencia): string {
  const { cabecera: c } = inf;
  const L: string[] = [];

  L.push(`ASISTENCIA — ${c.cuadrilla}`);
  L.push(`Fecha: ${fechaES(c.fecha)}`);
  if (c.finca?.trim()) L.push(`Finca: ${c.finca.trim()}`);
  if (c.producto) L.push(`Producto: ${c.producto}`);
  if (c.unidad) L.push(`Unidad: ${c.unidad}`);
  L.push("");
  L.push(`Trabajadores (${inf.recolectores.length}):`);
  inf.recolectores.forEach((n, i) => L.push(`${i + 1}. ${n}`));

  if (inf.auxiliares.length > 0) {
    L.push("");
    L.push(`Auxiliares (${inf.auxiliares.length}):`);
    inf.auxiliares.forEach((n, i) => L.push(`${i + 1}. ${n}`));
  }

  if (inf.grupos.length > 0) {
    L.push("");
    L.push("Grupos:");
    for (const g of inf.grupos) {
      L.push(`· ${g.nombre} (${g.miembros.length}): ${g.miembros.join(", ")}`);
    }
  }

  return L.join("\n");
}
