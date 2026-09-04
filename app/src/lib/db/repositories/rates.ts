import type { Rate } from "@cuadrilla/shared";
import { db } from "../dexie";

/** Tarifas (no borradas) de la organizacion, mas recientes primero. */
export async function todasLasTarifas(
  organizationId: string,
): Promise<Rate[]> {
  const todas = await db.rates
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todas
    .filter((r) => r.deleted === 0)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
}
