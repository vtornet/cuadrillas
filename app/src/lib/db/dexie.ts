import Dexie, { type Table } from "dexie";
import type {
  Crew,
  Entry,
  Organization,
  PendingOp,
  Product,
  Rate,
  Shift,
  UnitType,
  Worker,
} from "@cuadrilla/shared";

/** Pares clave/valor: `lastSyncAt`, marcas de bootstrap, sesion, etc. */
export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Base local. Todo se escribe aqui primero; la sincronizacion con el servidor
 * ocurre en segundo plano (paso 5).
 *
 * Notas de indexado:
 * - Clave primaria `id` (string, UUID de cliente) en todas las entidades, igual
 *   en el servidor.
 * - `deleted` y `activo` NO se indexan (Dexie no indexa 0/1 de forma util); se
 *   filtran en memoria tras la consulta.
 * - `pendingOps` usa clave autoincremental local (`localSeq`), nunca se sincroniza.
 */
export class CuadrillaDB extends Dexie {
  organizations!: Table<Organization, string>;
  crews!: Table<Crew, string>;
  workers!: Table<Worker, string>;
  products!: Table<Product, string>;
  unitTypes!: Table<UnitType, string>;
  rates!: Table<Rate, string>;
  shifts!: Table<Shift, string>;
  entries!: Table<Entry, string>;
  pendingOps!: Table<PendingOp, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("cuadrilla");
    this.version(1).stores({
      organizations: "id",
      crews: "id, organizationId",
      workers: "id, organizationId, crewId, alias",
      products: "id, organizationId",
      unitTypes: "id, organizationId, productId",
      rates: "id, organizationId, productId, unitTypeId",
      shifts: "id, organizationId, crewId, fecha, [crewId+fecha], estado",
      entries:
        "id, organizationId, shiftId, workerId, [shiftId+workerId], timestamp",
      pendingOps: "++localSeq, entityId, entity, createdAt",
      meta: "key",
    });
  }
}

export const db = new CuadrillaDB();
