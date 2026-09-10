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
