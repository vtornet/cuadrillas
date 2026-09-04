import type { Crew } from "@cuadrilla/shared";
import { db } from "../dexie";

/** Cuadrillas (no borradas) de las que el usuario es jefe. */
export async function crewsDelForeman(userId: string): Promise<Crew[]> {
  const todas = await db.crews.toArray();
  return todas
    .filter((c) => c.deleted === 0 && c.foremanIds.includes(userId))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function obtenerCrew(id: string): Promise<Crew | undefined> {
  return db.crews.get(id);
}

/** Todas las cuadrillas (no borradas) de la organizacion. */
export async function crewsDeOrg(organizationId: string): Promise<Crew[]> {
  const todas = await db.crews
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todas
    .filter((c) => c.deleted === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
