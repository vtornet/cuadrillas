import type { DatosLaborales, Worker } from "../types/worker";

/**
 * Estado del "alta" laboral de un trabajador (para el panel de empresa).
 * Pura, sin IO. Un alta está **completa** cuando tiene los datos mínimos para
 * identificar y pagar; el resto de campos de `DatosLaborales` son opcionales.
 */

export const CAMPOS_ALTA_MINIMOS = [
  "dni",
  "numAfiliacionSS",
  "iban",
  "fechaAlta",
] as const satisfies readonly (keyof DatosLaborales)[];

export type EstadoAlta = "pendiente" | "completa";

/** Campos mínimos que faltan por rellenar. */
export function faltanDatosAlta(w: Worker): string[] {
  const l = (w.laboral ?? {}) as Record<string, unknown>;
  return CAMPOS_ALTA_MINIMOS.filter(
    (k) => !String(l[k] ?? "").trim(),
  );
}

export function estadoAlta(w: Worker): EstadoAlta {
  return faltanDatosAlta(w).length === 0 ? "completa" : "pendiente";
}

/**
 * Normaliza unos datos laborales de entrada: recorta strings y descarta los
 * vacíos. Devuelve `undefined` si no queda nada (para borrar el sub-objeto).
 */
export function normalizarLaboral(
  datos: Partial<Record<keyof DatosLaborales, string | undefined>>,
): DatosLaborales | undefined {
  const salida: DatosLaborales = {};
  let algo = false;
  for (const [k, v] of Object.entries(datos)) {
    const limpio = (v ?? "").trim();
    if (limpio) {
      (salida as Record<string, string>)[k] = limpio;
      algo = true;
    }
  }
  return algo ? salida : undefined;
}
