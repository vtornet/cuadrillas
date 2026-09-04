import type { Group } from "@cuadrilla/shared";
import { db } from "../dexie";

/** Todos los grupos (no borrados) de la organizacion, para Gestion. */
export async function todosLosGrupos(organizationId: string): Promise<Group[]> {
  const todos = await db.groups
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todos
    .filter((g) => g.deleted === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Grupos activos de una cuadrilla, para elegir con cuales trabajar hoy. */
export async function gruposActivosDeCuadrilla(
  crewId: string,
): Promise<Group[]> {
  const todos = await db.groups.where("crewId").equals(crewId).toArray();
  return todos
    .filter((g) => g.deleted === 0 && g.activo === 1)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
