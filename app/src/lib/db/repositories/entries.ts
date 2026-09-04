import type { Entry } from "@cuadrilla/shared";
import { db } from "../dexie";
import { persistir } from "./base";

export interface NuevaEntryInput {
  organizationId: string;
  shiftId: string;
  /** Exactamente uno de los dos: workerId (registro individual) o groupId (grupo). */
  workerId?: string;
  groupId?: string;
  cantidad: number;
  registradoPor: string;
}

/** Crea el objeto Entry en memoria (aun no lo persiste). */
export function crearEntry(input: NuevaEntryInput): Entry {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    shiftId: input.shiftId,
    workerId: input.workerId,
    groupId: input.groupId,
    cantidad: input.cantidad,
    timestamp: now,
    registradoPor: input.registradoPor,
    updatedAt: now,
    deleted: 0,
  };
}

export async function registrarEntry(entry: Entry): Promise<void> {
  await persistir("entry", db.entries, entry);
}

/** Deshacer: marca la entry como borrada (lapida) y la reencola. */
export async function anularEntry(entry: Entry): Promise<void> {
  const anulada: Entry = { ...entry, deleted: 1, updatedAt: Date.now() };
  await persistir("entry", db.entries, anulada);
}

export function entriesDeJornada(shiftId: string): Promise<Entry[]> {
  return db.entries.where("shiftId").equals(shiftId).toArray();
}

export function entriesDeShifts(shiftIds: string[]): Promise<Entry[]> {
  return db.entries.where("shiftId").anyOf(shiftIds).toArray();
}
