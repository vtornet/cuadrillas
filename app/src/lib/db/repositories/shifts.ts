import type { GrupoDeJornada, Shift } from "@cuadrilla/shared";
import { db } from "../dexie";
import { persistir } from "./base";

export function obtenerShift(id: string): Promise<Shift | undefined> {
  return db.shifts.get(id);
}

/** Jornadas abiertas (no borradas), mas recientes primero. */
export async function jornadasAbiertas(): Promise<Shift[]> {
  const abiertas = await db.shifts.where("estado").equals("open").toArray();
  return abiertas
    .filter((s) => s.deleted === 0)
    .sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b.updatedAt - a.updatedAt,
    );
}

export interface NuevaShiftInput {
  organizationId: string;
  crewId: string;
  productId: string;
  unitTypeId: string;
  fecha: string;
  /** Finca (texto libre, opcional). */
  finca?: string;
  horaInicio: string;
  attendeeIds: string[];
  /** Si se trabaja por grupos ese dia: su composicion inicial. */
  groups?: GrupoDeJornada[];
}

export async function crearShift(input: NuevaShiftInput): Promise<Shift> {
  const now = Date.now();
  const shift: Shift = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    crewId: input.crewId,
    fecha: input.fecha,
    finca: input.finca?.trim() || undefined,
    horaInicio: input.horaInicio,
    horaFin: null,
    productId: input.productId,
    unitTypeId: input.unitTypeId,
    estado: "open",
    attendeeIds: [...input.attendeeIds],
    groups: input.groups?.map((g) => ({ ...g, memberIds: [...g.memberIds] })),
    updatedAt: now,
    deleted: 0,
  };
  await persistir("shift", db.shifts, shift);
  return shift;
}

export async function guardarShift(shift: Shift): Promise<void> {
  await persistir("shift", db.shifts, shift);
}

/** Todas las jornadas (no borradas) de la organizacion. Sin ordenar. */
export async function shiftsDeOrg(organizationId: string): Promise<Shift[]> {
  const todos = await db.shifts
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todos.filter((s) => s.deleted === 0);
}

/** Fincas distintas usadas en partes anteriores de unas cuadrillas (para autocompletar). */
export async function fincasUsadas(crewIds: string[]): Promise<string[]> {
  const todos = await db.shifts.where("crewId").anyOf(crewIds).toArray();
  const set = new Set<string>();
  for (const s of todos) {
    if (s.deleted === 0 && s.finca?.trim()) set.add(s.finca.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** Todas las jornadas (no borradas) de unas cuadrillas, mas recientes primero. */
export async function shiftsDeCuadrillas(crewIds: string[]): Promise<Shift[]> {
  const todos = await db.shifts.where("crewId").anyOf(crewIds).toArray();
  return todos
    .filter((s) => s.deleted === 0)
    .sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b.updatedAt - a.updatedAt,
    );
}
