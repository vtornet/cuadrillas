export type EntityName =
  | "organization"
  | "crew"
  | "worker"
  | "product"
  | "unitType"
  | "rate"
  | "shift"
  | "entry";

/**
 * Operación pendiente de enviar al servidor. Se encola en local (`pending_ops`)
 * en la misma transacción que la escritura de la entidad.
 */
export interface PendingOp {
  /** Clave autoincremental local de Dexie. No se envía al servidor. */
  localSeq?: number;
  entity: EntityName;
  entityId: string;
  op: "upsert" | "delete";
  /** Estado completo del registro tras el cambio. */
  payload: unknown;
  updatedAt: number;
  createdAt: number;
}

export interface SyncRequest {
  /** ISO. `null` en el primer arranque (bootstrap): el servidor devuelve todo. */
  lastSyncAt: string | null;
  ops: PendingOp[];
}

export interface SyncResponse {
  /** ISO. El cliente lo guarda como nuevo `lastSyncAt`. */
  serverTime: string;
  /** Registros con `serverUpdatedAt > lastSyncAt`, agrupados por entidad. */
  changes: Partial<Record<EntityName, unknown[]>>;
  /** ids de operaciones aceptadas. */
  applied: string[];
  /** Operaciones rechazadas (p. ej. por límite de plan). El cliente las revierte. */
  rejected: Array<{ id: string; entity?: EntityName; reason: string }>;
}
