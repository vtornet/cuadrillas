import type {
  EntityName,
  PendingOp,
  RegistroSincronizable,
} from "@cuadrilla/shared";
import { entranteGana } from "@cuadrilla/shared/domain";
import { db } from "../db/dexie";
import { getMeta, setMeta } from "../db/meta";
import { tablaPorEntidad } from "../db/tablas";
import { auth } from "../auth/auth.svelte";
import { postSync, SyncAuthError } from "./client";

export interface ResultadoSync {
  ok: boolean;
  motivo?: string;
  rechazos?: Array<{ id: string; reason: string }>;
}

let enMarcha = false;

export async function sincronizar(): Promise<ResultadoSync> {
  if (enMarcha) return { ok: false, motivo: "en curso" };
  if (auth.estado !== "autenticado" || !auth.token) {
    return { ok: false, motivo: "sin sesion" };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, motivo: "sin red" };
  }

  enMarcha = true;
  try {
    const pendientes = await db.pendingOps.orderBy("localSeq").toArray();
    const lastSyncAt = (await getMeta<string>("lastSyncAt")) ?? null;

    const ops: PendingOp[] = pendientes.map((p) => ({
      entity: p.entity,
      entityId: p.entityId,
      op: p.op,
      payload: p.payload,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
    }));

    const resp = await postSync(auth.token, { lastSyncAt, ops });

    await db.transaction("rw", db.tables, async () => {
      // 1. Aplicar cambios entrantes (LWW).
      for (const [entity, registros] of Object.entries(resp.changes)) {
        const tabla = tablaPorEntidad(entity as EntityName);
        for (const raw of (registros ?? []) as RegistroSincronizable[]) {
          const local = await tabla.get(raw.id);
          if (entranteGana(raw, local ?? undefined)) {
            const conMarca =
              entity === "entry" ? { ...raw, syncedAt: Date.now() } : raw;
            await tabla.put(conMarca as never);
          }
        }
      }

      // 2. Quitar de la cola las operaciones aceptadas.
      const aceptadas = new Set(resp.applied);
      const seqAceptadas = pendientes
        .filter((p) => aceptadas.has(p.entityId))
        .map((p) => p.localSeq as number);
      await db.pendingOps.bulkDelete(seqAceptadas);

      // 3. Rechazos: quitar la operacion y revertir el registro local.
      const idsEnServidor = new Set(
        Object.values(resp.changes)
          .flat()
          .map((r) => (r as RegistroSincronizable | undefined)?.id),
      );
      for (const rj of resp.rejected) {
        const opsRj = pendientes.filter((p) => p.entityId === rj.id);
        await db.pendingOps.bulkDelete(
          opsRj.map((p) => p.localSeq as number),
        );
        const entity = rj.entity ?? opsRj[0]?.entity;
        if (entity && !idsEnServidor.has(rj.id)) {
          await tablaPorEntidad(entity).delete(rj.id);
        }
      }

      await setMeta("lastSyncAt", resp.serverTime);
    });

    return {
      ok: true,
      rechazos: resp.rejected.map((r) => ({ id: r.id, reason: r.reason })),
    };
  } catch (e) {
    if (e instanceof SyncAuthError) {
      await auth.salir();
      return { ok: false, motivo: "sesion caducada" };
    }
    console.error("[sync]", e);
    return { ok: false, motivo: "error" };
  } finally {
    enMarcha = false;
  }
}
