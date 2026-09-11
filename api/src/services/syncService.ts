import type { EntityName, PendingOp, SyncResponse } from "@cuadrilla/shared";
import { ENTIDADES, LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import { entranteGana } from "@cuadrilla/shared/domain";
import { Modelos, type DocBase } from "../models/sync";

interface Contexto {
  organizationId: string;
  /** Quién sincroniza — determina qué cuadrillas ve (ver `cambiosDesde`). */
  userId: string;
}

interface RegistroEntrante {
  id: string;
  updatedAt: number;
  deleted?: boolean | 0 | 1;
  [campo: string]: unknown;
}

/** Entidades ligadas a una cuadrilla: solo se envían las de las cuadrillas del jefe. */
const ENTIDADES_POR_CUADRILLA = new Set<EntityName>(["worker", "group", "shift"]);

export async function procesarSync(
  ctx: Contexto,
  lastSyncAt: string | null,
  ops: PendingOp[],
): Promise<SyncResponse> {
  const applied: string[] = [];
  const rejected: SyncResponse["rejected"] = [];
  const ahora = new Date();

  // Cuadrillas de las que `userId` es jefe ahora mismo. Se amplía sobre la
  // marcha según se aplican altas de cuadrilla DENTRO del mismo lote (p. ej.
  // el jefe crea una cuadrilla y en el mismo push ya manda trabajadores para
  // ella — ver el `add()` al final del bucle).
  const misCuadrillas = new Set(await crewIdsDe(ctx.organizationId, ctx.userId));
  // shiftId -> crewId ya resueltos en este lote (evita repetir la consulta
  // y ve los `shift` recien creados en el propio lote).
  const crewDeShift = new Map<string, string>();

  for (const op of ops) {
    const modelo = Modelos[op.entity];
    if (!modelo) {
      rejected.push({ id: op.entityId, entity: op.entity, reason: "entidad desconocida" });
      continue;
    }

    const entrante = normalizar(op.payload, ctx.organizationId);
    if (!entrante) {
      rejected.push({ id: op.entityId, entity: op.entity, reason: "payload invalido" });
      continue;
    }

    const actual = await modelo.findById(entrante._id).lean<DocBase | null>();

    // Autorización por cuadrilla: igual que el pull (`cambiosDesde`) solo
    // entrega lo de las cuadrillas del jefe, la escritura solo debe aceptar
    // registros de SUS cuadrillas — si no, un jefe podría empujar un
    // trabajador/parte/anotación con el `crewId`/`shiftId` de una cuadrilla
    // ajena de la misma organización, o secuestrar una cuadrilla ajena
    // (renombrarla, meterse en su `foremanIds`).
    const motivoRechazo = await autorizadoParaEscribir(
      op.entity,
      entrante,
      actual,
      misCuadrillas,
      crewDeShift,
      ctx,
    );
    if (motivoRechazo) {
      rejected.push({ id: op.entityId, entity: op.entity, reason: motivoRechazo });
      continue;
    }

    // LWW: si el servidor ya tiene una version mas nueva, no se aplica; el
    // cliente recibira esa version en `changes` y se cuenta como "applied".
    if (!entranteGana(entrante, actual ?? undefined)) {
      applied.push(op.entityId);
      continue;
    }

    // Limite del plan gratuito al crear cuadrilla o trabajador.
    const esAlta = !actual && !entrante.deleted;
    if (esAlta && (op.entity === "crew" || op.entity === "worker")) {
      const permitido = await dentroDelLimite(ctx.organizationId, op.entity);
      if (!permitido) {
        rejected.push({
          id: op.entityId,
          entity: op.entity,
          reason: "limite del plan alcanzado",
        });
        continue;
      }
    }

    await modelo.updateOne(
      { _id: entrante._id },
      { $set: { ...entrante, serverUpdatedAt: ahora } },
      { upsert: true },
    );
    applied.push(op.entityId);

    // Registrar lo recién creado para que el resto del MISMO lote lo vea.
    if (op.entity === "crew" && ((entrante.foremanIds as string[] | undefined) ?? []).includes(ctx.userId)) {
      misCuadrillas.add(entrante._id);
    } else if (op.entity === "shift" && typeof entrante.crewId === "string") {
      crewDeShift.set(entrante._id, entrante.crewId);
    }
  }

  const changes = await cambiosDesde(ctx.organizationId, ctx.userId, lastSyncAt);
  return { serverTime: ahora.toISOString(), changes, applied, rejected };
}

/**
 * `null` si `userId` puede escribir este registro; si no, el motivo del
 * rechazo. Solo mira las entidades ligadas a una cuadrilla (`crew` incluida);
 * el resto (organization/product/unitType/finca/rate) es catálogo de la
 * organización, igual para todos los jefes — sin restricción aquí.
 */
async function autorizadoParaEscribir(
  entity: EntityName,
  entrante: RegistroEntrante & { _id: string },
  actual: DocBase | null,
  misCuadrillas: Set<string>,
  crewDeShift: Map<string, string>,
  ctx: Contexto,
): Promise<string | null> {
  if (entity === "crew") {
    // Alta de cuadrilla nueva: permitida (el jefe se pone a sí mismo como
    // jefe desde `CrewForm`). Cuadrilla ya existente: solo si ya es jefe de
    // ella — si no, podría secuestrarla.
    if (actual && !(((actual.foremanIds as string[] | undefined) ?? []).includes(ctx.userId))) {
      return "cuadrilla ajena";
    }
    return null;
  }

  if (entity === "worker" || entity === "group" || entity === "shift") {
    const crewId = entrante.crewId;
    if (typeof crewId !== "string" || !misCuadrillas.has(crewId)) {
      return "cuadrilla ajena";
    }
    return null;
  }

  if (entity === "entry") {
    const shiftId = entrante.shiftId;
    if (typeof shiftId !== "string") return "parte ajeno";
    let crewId = crewDeShift.get(shiftId);
    if (!crewId) {
      const shift = await Modelos.shift.findById(shiftId).lean<{ crewId?: string } | null>();
      crewId = shift?.crewId;
      if (crewId) crewDeShift.set(shiftId, crewId);
    }
    if (!crewId || !misCuadrillas.has(crewId)) return "parte ajeno";
    return null;
  }

  return null;
}

/** Fuerza `organizationId` al del token y `deleted` a booleano. */
function normalizar(
  payload: unknown,
  organizationId: string,
): (RegistroEntrante & { _id: string; organizationId: string; deleted: boolean }) | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as RegistroEntrante;
  if (typeof p.id !== "string" || typeof p.updatedAt !== "number") return null;
  const deleted = p.deleted === true || p.deleted === 1;
  return { ...p, _id: p.id, organizationId, deleted };
}

async function dentroDelLimite(
  organizationId: string,
  entity: "crew" | "worker",
): Promise<boolean> {
  const org = await Modelos.organization
    .findById(organizationId)
    .lean<{ planLimits?: { crews: number; workers: number } } | null>();
  const limites = org?.planLimits ?? LIMITES_PLAN_GRATIS;

  const n = await Modelos[entity].countDocuments({ organizationId, deleted: false });
  const limite = entity === "crew" ? limites.crews : limites.workers;
  return n < limite;
}

/** Ids de las cuadrillas (no borradas) de las que `userId` es jefe. */
async function crewIdsDe(organizationId: string, userId: string): Promise<string[]> {
  const crews = await Modelos.crew
    .find({ organizationId, foremanIds: userId, deleted: false })
    .lean<{ _id: string }[]>();
  return crews.map((c) => c._id);
}

/**
 * Cambios desde `lastSyncAt`, **acotados a lo que le corresponde a `userId`**:
 * - `crew`: solo las cuadrillas de las que es jefe.
 * - `worker` / `group` / `shift`: solo los de esas cuadrillas.
 * - `entry`: solo los de los partes (`shift`) de esas cuadrillas.
 * - `organization` / `product` / `unitType` / `finca`: catálogo de la
 *   organización, igual para todos (sin `crewId`, no son datos de una cuadrilla).
 * - `rate`: **no se envía** (2026-09-11) — es dato económico y la app del
 *   jefe no lo usa desde que se quitó Liquidación (ver "Dinero" en
 *   CLAUDE.md); antes viajaba al dispositivo sin usarse, heredado de antes
 *   del panel. El panel lo lee por su cuenta vía `GET /admin/tarifas`
 *   (`adminService`), no por `/sync`.
 *
 * Antes se enviaba TODO lo de la organización a cualquier jefe — en una
 * empresa con varias cuadrillas, un jefe recibía los trabajadores y partes de
 * los demás. `PUT /admin/jefes/:id/cuadrillas` y la aceptación de una
 * invitación bumpean `serverUpdatedAt` de la cuadrilla recién asignada (ver
 * `refrescarCuadrilla` en `adminService`) para que este cursor por fecha no se
 * salte su historial al ganar acceso.
 */
async function cambiosDesde(
  organizationId: string,
  userId: string,
  lastSyncAt: string | null,
): Promise<SyncResponse["changes"]> {
  const base: Record<string, unknown> = { organizationId };
  if (lastSyncAt) base.serverUpdatedAt = { $gt: new Date(lastSyncAt) };

  const crewIds = await crewIdsDe(organizationId, userId);

  const changes: SyncResponse["changes"] = {};
  for (const entity of ENTIDADES) {
    if (entity === "rate") continue;

    let filtro = base;
    if (entity === "crew") {
      filtro = { ...base, foremanIds: userId };
    } else if (ENTIDADES_POR_CUADRILLA.has(entity)) {
      filtro = { ...base, crewId: { $in: crewIds } };
    } else if (entity === "entry") {
      const shiftIds = await Modelos.shift
        .find({ organizationId, crewId: { $in: crewIds } })
        .distinct("_id");
      filtro = { ...base, shiftId: { $in: shiftIds } };
    }

    const docs = await Modelos[entity].find(filtro).lean<DocBase[]>();
    if (docs.length > 0) {
      changes[entity] = docs.map(aWire);
    }
  }
  return changes;
}

/**
 * Bumpea `serverUpdatedAt` de todo lo que pertenece a una cuadrilla
 * (trabajadores, grupos, partes y sus anotaciones), para que el cursor por
 * fecha de `cambiosDesde` no se salte el historial cuando alguien gana acceso
 * a esa cuadrilla (invitación aceptada con `lastSyncAt` ya existente, o
 * reasignación). Se llama desde `adminService` al asignar cuadrillas a un jefe.
 */
export async function refrescarCuadrilla(
  organizationId: string,
  crewId: string,
): Promise<void> {
  const ahora = new Date();
  const control = { updatedAt: Date.now(), serverUpdatedAt: ahora };

  const shiftIds = await Modelos.shift
    .find({ organizationId, crewId })
    .distinct("_id");

  await Promise.all([
    Modelos.worker.updateMany({ organizationId, crewId }, { $set: control }),
    Modelos.group.updateMany({ organizationId, crewId }, { $set: control }),
    Modelos.shift.updateMany({ organizationId, crewId }, { $set: control }),
    shiftIds.length > 0
      ? Modelos.entry.updateMany(
          { organizationId, shiftId: { $in: shiftIds } },
          { $set: control },
        )
      : Promise.resolve(),
  ]);
}

/** Doc de Mongo -> forma que espera el cliente (`id`, `deleted` como 0/1). */
function aWire(doc: DocBase): Record<string, unknown> {
  const { _id, serverUpdatedAt, deleted, ...resto } = doc;
  return { ...resto, id: _id, deleted: deleted ? 1 : 0 };
}
