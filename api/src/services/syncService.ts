import type { PendingOp, SyncResponse } from "@cuadrilla/shared";
import { ENTIDADES, LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import { entranteGana } from "@cuadrilla/shared/domain";
import { Modelos, type DocBase } from "../models/sync";

interface Contexto {
  organizationId: string;
}

interface RegistroEntrante {
  id: string;
  updatedAt: number;
  deleted?: boolean | 0 | 1;
  [campo: string]: unknown;
}

export async function procesarSync(
  ctx: Contexto,
  lastSyncAt: string | null,
  ops: PendingOp[],
): Promise<SyncResponse> {
  const applied: string[] = [];
  const rejected: SyncResponse["rejected"] = [];
  const ahora = new Date();

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
  }

  const changes = await cambiosDesde(ctx.organizationId, lastSyncAt);
  return { serverTime: ahora.toISOString(), changes, applied, rejected };
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

async function cambiosDesde(
  organizationId: string,
  lastSyncAt: string | null,
): Promise<SyncResponse["changes"]> {
  const filtro: Record<string, unknown> = { organizationId };
  if (lastSyncAt) filtro.serverUpdatedAt = { $gt: new Date(lastSyncAt) };

  const changes: SyncResponse["changes"] = {};
  for (const entity of ENTIDADES) {
    const docs = await Modelos[entity].find(filtro).lean<DocBase[]>();
    if (docs.length > 0) {
      changes[entity] = docs.map(aWire);
    }
  }
  return changes;
}

/** Doc de Mongo -> forma que espera el cliente (`id`, `deleted` como 0/1). */
function aWire(doc: DocBase): Record<string, unknown> {
  const { _id, serverUpdatedAt, deleted, ...resto } = doc;
  return { ...resto, id: _id, deleted: deleted ? 1 : 0 };
}
