import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/lib/db/dexie";
import {
  anularEntry,
  crearEntry,
  entriesDeJornada,
  registrarEntry,
} from "../src/lib/db/repositories/entries";

function entryDemo() {
  return crearEntry({
    organizationId: "o",
    shiftId: "s",
    workerId: "w",
    cantidad: 5,
    registradoPor: "u",
  });
}

describe("repositorio de entries", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("registrar guarda la entry y encola una operacion pendiente", async () => {
    const e = entryDemo();
    await registrarEntry(e);

    expect(await db.entries.count()).toBe(1);
    expect(await db.pendingOps.count()).toBe(1);

    const op = await db.pendingOps.toCollection().first();
    expect(op?.entity).toBe("entry");
    expect(op?.op).toBe("upsert");
    expect(op?.entityId).toBe(e.id);
  });

  it("anular marca la lapida y reencola como delete", async () => {
    const e = entryDemo();
    await registrarEntry(e);
    await anularEntry(e);

    const guardada = await db.entries.get(e.id);
    expect(guardada?.deleted).toBe(1);
    expect(guardada?.updatedAt).toBeGreaterThanOrEqual(e.updatedAt);

    expect(await db.pendingOps.count()).toBe(2);
    const ops = await db.pendingOps.orderBy("localSeq").toArray();
    expect(ops[1]?.op).toBe("delete");
  });

  it("entriesDeJornada devuelve solo las de esa jornada", async () => {
    const a = crearEntry({
      organizationId: "o",
      shiftId: "s1",
      workerId: "w",
      cantidad: 1,
      registradoPor: "u",
    });
    const b = crearEntry({
      organizationId: "o",
      shiftId: "s2",
      workerId: "w",
      cantidad: 2,
      registradoPor: "u",
    });
    await registrarEntry(a);
    await registrarEntry(b);

    const s1 = await entriesDeJornada("s1");
    expect(s1).toHaveLength(1);
    expect(s1[0]?.shiftId).toBe("s1");
  });
});
