import type { Entry } from "../types/entry";

export type EntryConteo = Pick<Entry, "workerId" | "cantidad" | "deleted">;

/**
 * Suma las cantidades por trabajador, ignorando registros borrados (lápidas).
 * Función pura: misma implementación en cliente (pantalla de Registro y
 * estadísticas) y servidor.
 */
export function sumarConteos(entries: EntryConteo[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const e of entries) {
    if (e.deleted) continue;
    acc[e.workerId] = (acc[e.workerId] ?? 0) + e.cantidad;
  }
  return acc;
}

/** Total de la jornada: suma de todos los conteos por trabajador. */
export function totalJornada(conteos: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(conteos)) total += v;
  return total;
}
