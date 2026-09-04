import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncResponse, Worker } from "@cuadrilla/shared";
import { db } from "../src/lib/db/dexie";
import { getMeta } from "../src/lib/db/meta";
import { auth } from "../src/lib/auth/auth.svelte";
import { sincronizar } from "../src/lib/sync/engine";

function worker(id: string, updatedAt: number, name: string): Worker {
  return {
    id,
    organizationId: "org1",
    name,
    alias: id.toUpperCase(),
    crewId: "c",
    language: "es",
    activo: 1,
    updatedAt,
    deleted: 0,
  };
}

function respuesta(body: SyncResponse): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  auth.estado = "autenticado";
  auth.token = "tkn";
  auth.organizationId = "org1";
});

afterEach(() => {
  vi.unstubAllGlobals();
  auth.token = null;
  auth.estado = "demo";
});

describe("motor de sincronizacion", () => {
  it("envia pendientes, los quita al aceptarse y aplica cambios entrantes", async () => {
    await db.workers.put(worker("w1", 100, "Local"));
    await db.pendingOps.add({
      entity: "worker",
      entityId: "w1",
      op: "upsert",
      payload: {},
      updatedAt: 100,
      createdAt: 1,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      respuesta({
        serverTime: "2026-09-04T10:00:00.000Z",
        applied: ["w1"],
        rejected: [],
        changes: { worker: [worker("w2", 500, "DelServidor")] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await sincronizar();

    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(await db.pendingOps.count()).toBe(0);
    expect((await db.workers.get("w2"))?.name).toBe("DelServidor");
    expect(await getMeta("lastSyncAt")).toBe("2026-09-04T10:00:00.000Z");
  });

  it("LWW: un entrante mas viejo no pisa un registro local mas nuevo", async () => {
    await db.workers.put(worker("w1", 9000, "NUEVO-LOCAL"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuesta({
          serverTime: "2026-09-04T10:00:00.000Z",
          applied: [],
          rejected: [],
          changes: { worker: [worker("w1", 100, "VIEJO")] },
        }),
      ),
    );

    await sincronizar();
    expect((await db.workers.get("w1"))?.name).toBe("NUEVO-LOCAL");
  });

  it("un rechazo borra el registro local y su operacion pendiente", async () => {
    await db.workers.put(worker("w11", 100, "Sobra"));
    await db.pendingOps.add({
      entity: "worker",
      entityId: "w11",
      op: "upsert",
      payload: {},
      updatedAt: 100,
      createdAt: 1,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuesta({
          serverTime: "2026-09-04T10:00:00.000Z",
          applied: [],
          changes: {},
          rejected: [
            { id: "w11", entity: "worker", reason: "limite del plan alcanzado" },
          ],
        }),
      ),
    );

    const r = await sincronizar();
    expect(r.rechazos?.[0].reason).toMatch(/limite/);
    expect(await db.workers.get("w11")).toBeUndefined();
    expect(await db.pendingOps.count()).toBe(0);
  });

  it("no hace nada sin sesion", async () => {
    auth.estado = "demo";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const r = await sincronizar();
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
