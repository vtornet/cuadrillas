import type { Entry } from "../types/entry";

export type EntryConteo = Pick<
  Entry,
  "workerId" | "groupId" | "cantidad" | "deleted"
>;

/**
 * Suma las cantidades por "sujeto" (trabajador o grupo, segun tenga cada
 * registro), ignorando registros borrados (lápidas). Sirve igual para la
 * pantalla de Registro trabajando por trabajador o por grupo.
 *
 * Función pura: misma implementación en cliente y servidor.
 */
export function sumarConteos(entries: EntryConteo[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const e of entries) {
    if (e.deleted) continue;
    const sujeto = e.workerId ?? e.groupId;
    if (!sujeto) continue;
    acc[sujeto] = (acc[sujeto] ?? 0) + e.cantidad;
  }
  return acc;
}

/** Total de la jornada: suma de todos los conteos. */
export function totalJornada(conteos: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(conteos)) total += v;
  return total;
}
