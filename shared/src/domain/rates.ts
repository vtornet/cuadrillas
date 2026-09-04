import type { Rate } from "../types/rate";

/**
 * Tarifa vigente para (producto, unidad) en una fecha dada (`YYYY-MM-DD`).
 *
 * - `validFrom` inclusive; `validTo` inclusive o `null` (tarifa abierta).
 * - Si varias tarifas solapan, gana la de `validFrom` mas reciente.
 * - Se aplica sobre `Shift.fecha` (dia natural), no sobre el timestamp de cada
 *   registro.
 *
 * Funcion pura: misma implementacion en cliente y servidor.
 */
export function resolverTarifa(
  rates: Rate[],
  productId: string,
  unitTypeId: string,
  fecha: string,
): Rate | null {
  const vigentes = rates
    .filter(
      (r) =>
        r.deleted === 0 &&
        r.productId === productId &&
        r.unitTypeId === unitTypeId &&
        r.validFrom <= fecha &&
        (r.validTo === null || r.validTo >= fecha),
    )
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  return vigentes[0] ?? null;
}
