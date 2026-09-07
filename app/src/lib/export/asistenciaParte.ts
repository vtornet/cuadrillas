/**
 * Texto plano de la asistencia de un parte, para enviar por WhatsApp / email /
 * compartir. Sin importes. Puro y testable.
 */

export interface GrupoAsistencia {
  nombre: string;
  miembros: string[];
}

export interface DatosAsistenciaParte {
  cuadrilla: string;
  /** Fecha ISO `YYYY-MM-DD`. */
  fecha: string;
  producto: string;
  unidad: string;
  /** Nombres de los recolectores presentes (se ordenan aquí). */
  nombres: string[];
  /** Nombres de los auxiliares presentes (se ordenan aquí). */
  auxiliares?: string[];
  /** Si el parte se trabaja por grupos: composición de hoy. */
  grupos?: GrupoAsistencia[];
}

function fechaES(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function textoAsistenciaParte(d: DatosAsistenciaParte): string {
  const nombres = [...d.nombres].sort((a, b) => a.localeCompare(b, "es"));
  const L: string[] = [];

  L.push(`ASISTENCIA — ${d.cuadrilla}`);
  L.push(`Fecha: ${fechaES(d.fecha)}`);
  if (d.producto || d.unidad) {
    L.push(`Producto: ${[d.producto, d.unidad].filter(Boolean).join(" · ")}`);
  }
  L.push("");
  L.push(`Trabajadores (${nombres.length}):`);
  nombres.forEach((n, i) => L.push(`${i + 1}. ${n}`));

  const aux = [...(d.auxiliares ?? [])].sort((a, b) => a.localeCompare(b, "es"));
  if (aux.length > 0) {
    L.push("");
    L.push(`Auxiliares (${aux.length}):`);
    aux.forEach((n, i) => L.push(`${i + 1}. ${n}`));
  }

  if (d.grupos && d.grupos.length > 0) {
    L.push("");
    L.push("Grupos:");
    for (const g of d.grupos) {
      const m = [...g.miembros].sort((a, b) => a.localeCompare(b, "es"));
      L.push(`· ${g.nombre} (${m.length}): ${m.join(", ")}`);
    }
  }

  return L.join("\n");
}
