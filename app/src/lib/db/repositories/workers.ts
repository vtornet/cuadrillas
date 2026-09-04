import type { Worker } from "@cuadrilla/shared";
import { db } from "../dexie";
import { persistir } from "./base";

/** Trabajadores activos (no borrados) de una cuadrilla. */
export async function trabajadoresDeCuadrilla(
  crewId: string,
): Promise<Worker[]> {
  const todos = await db.workers.where("crewId").equals(crewId).toArray();
  return todos
    .filter((w) => w.deleted === 0 && w.activo === 1)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Todos los trabajadores (activos e inactivos, no borrados) de la organizacion. */
export async function todosLosWorkers(
  organizationId: string,
): Promise<Worker[]> {
  const todos = await db.workers
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todos
    .filter((w) => w.deleted === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Trabajadores (activos e inactivos, no borrados) de unas cuadrillas. */
export async function workersDeCuadrillas(crewIds: string[]): Promise<Worker[]> {
  const todos = await db.workers.where("crewId").anyOf(crewIds).toArray();
  return todos.filter((w) => w.deleted === 0);
}

/** Guarda cambios en un trabajador (encola operacion pendiente). */
export async function guardarWorker(worker: Worker): Promise<void> {
  await persistir("worker", db.workers, worker);
}
