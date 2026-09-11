import type { InformeTrabajador } from "@cuadrilla/shared/domain";
import { fechaES } from "@cuadrilla/shared/domain";
import { centimosAEuros } from "../money";

const MIME = "text/plain;charset=utf-8";

/**
 * Informe RGPD de un trabajador como texto legible (para entregárselo al
 * trabajador). Sin importes de destajo — solo su ficha y los días trabajados.
 */
export function informeATexto(inf: InformeTrabajador): string {
  const w = inf.worker;
  const L: string[] = [];

  L.push("INFORME DE DATOS PERSONALES");
  L.push(`Generado el ${formatoFechaHora(inf.generadoEl)}`);
  L.push("");
  L.push("FICHA DEL TRABAJADOR");
  L.push(`  Nombre:      ${w.name}`);
  L.push(`  Alias/código: ${w.alias}`);
  L.push(`  Cuadrilla:   ${w.cuadrilla}`);
  if (w.codigoQr) L.push(`  Código QR:   ${w.codigoQr}`);
  if (w.transporteCentimos > 0) {
    L.push(`  Transporte:  ${centimosAEuros(w.transporteCentimos)} por día`);
  }
  L.push("");
  L.push(
    `DÍAS TRABAJADOS: ${inf.totalDias}   ·   UNIDADES REGISTRADAS: ${inf.totalUnidades}`,
  );
  L.push("");

  if (inf.dias.length === 0) {
    L.push("  (sin partes registrados)");
  } else {
    for (const d of inf.dias) {
      const detalle = d.porGrupos
        ? "trabajo en grupo (sin desglose individual)"
        : `${d.numAnotaciones} anotación(es), ${d.totalUnidades} ${d.unidad.toLowerCase()}(s)`;
      const asistencia = d.presente ? "" : " (sin marcar en asistencia)";
      L.push(`  ${fechaES(d.fecha)}  ${d.cuadrilla} · ${d.producto}${asistencia}`);
      L.push(`             ${detalle}`);
    }
  }

  L.push("");
  L.push("---");
  L.push(
    "Este informe recoge los datos personales tratados en la aplicación. " +
      "Para rectificarlos o solicitar su supresión, contacta con el responsable " +
      "del tratamiento (ver política de privacidad).",
  );

  return L.join("\n");
}

export function informeABlob(inf: InformeTrabajador): Blob {
  return new Blob([informeATexto(inf)], { type: MIME });
}

function formatoFechaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
