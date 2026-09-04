import type { Table } from "dexie";
import type {
  EntityName,
  PendingOp,
  RegistroSincronizable,
} from "@cuadrilla/shared";
import { db } from "../dexie";

/**
 * Escritura local atomica: guarda el registro y encola la operacion pendiente
 * en la MISMA transaccion. Nunca una sin la otra.
 *
 * El registro se normaliza a objeto plano antes de escribir: si viniera un
 * proxy de estado de Svelte (p. ej. arrays anidados como `attendeeIds`),
 * IndexedDB no podria clonarlo (`DataCloneError`).
 */
export async function persistir<T extends RegistroSincronizable>(
  entity: EntityName,
  table: Table<T, string>,
  record: T,
): Promise<void> {
  const plano = JSON.parse(JSON.stringify(record)) as T;
  await db.transaction("rw", table, db.pendingOps, async () => {
    await table.put(plano);
    const op: PendingOp = {
      entity,
      entityId: plano.id,
      op: plano.deleted ? "delete" : "upsert",
      payload: plano,
      updatedAt: plano.updatedAt,
      createdAt: Date.now(),
    };
    await db.pendingOps.add(op);
  });
}
