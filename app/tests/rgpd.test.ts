import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Entry, Shift, Worker } from "@cuadrilla/shared";
import { db } from "../src/lib/db/dexie";
import { gestion } from "../src/lib/stores/gestion.svelte";
import { sesion } from "../src/lib/stores/sesion.svelte";
import { generarInformeTrabajador } from "../src/lib/rgpd";
import { informeATexto } from "../src/lib/export/rgpd";

const ORG = sesion.organizationId;

function shift(p: Partial<Shift>): Shift {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    crewId: "c1",
    fecha: "2026-09-01",
    horaInicio: "08:00",
    horaFin: "14:00",
    productId: "p1",
    unitTypeId: "u1",
    estado: "closed",
    attendeeIds: ["w1"],
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function entry(p: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    shiftId: "s1",
    workerId: "w1",
    cantidad: 1,
    timestamp: 1,
    registradoPor: "u1",
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

describe("RGPD end-to-end", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.crews.put({
      id: "c1",
      organizationId: ORG,
      name: "Cuadrilla Norte",
      foremanIds: [sesion.userId], // gestion.cargar() filtra por foremanIds
      updatedAt: 1,
      deleted: 0,
    });
    await db.products.put({
      id: "p1",
      organizationId: ORG,
      name: "Naranja",
      activo: 1,
      updatedAt: 1,
      deleted: 0,
    });
    await db.unitTypes.put({
      id: "u1",
      organizationId: ORG,
      name: "Caja",
      abbr: "cj",
      productId: "p1",
      updatedAt: 1,
      deleted: 0,
    });
    const w1: Worker = {
      id: "w1",
      organizationId: ORG,
      name: "Juan Pérez",
      alias: "JUAN",
      crewId: "c1",
      language: "es",
      activo: 1,
      qrCode: "JUAN",
      transporteCentimos: 500,
      updatedAt: 1,
      deleted: 0,
    };
    await gestion.guardar("worker", w1);
    await db.shifts.bulkPut([
      shift({ id: "s1", fecha: "2026-09-01" }),
      shift({ id: "s2", fecha: "2026-09-02", attendeeIds: ["w1"] }),
    ]);
    await db.entries.bulkPut([
      entry({ shiftId: "s1", cantidad: 3 }),
      entry({ shiftId: "s1", cantidad: 2 }),
    ]);
    await gestion.cargar();
  });

  it("genera el informe con la ficha y los días trabajados", async () => {
    const w = gestion.workers.find((x) => x.id === "w1")!;
    const inf = await generarInformeTrabajador(w);

    expect(inf.worker.name).toBe("Juan Pérez");
    expect(inf.worker.cuadrilla).toBe("Cuadrilla Norte");
    expect(inf.totalDias).toBe(2);
    expect(inf.totalUnidades).toBe(5);

    const txt = informeATexto(inf);
    expect(txt).toContain("Juan Pérez");
    expect(txt).toContain("01/09/2026");
    expect(txt).toContain("Naranja");
    expect(txt).not.toMatch(/EUR|€\s*\d|importe/i);
  });

  it("anonimizar borra los datos personales y encola el cambio", async () => {
    const w = gestion.workers.find((x) => x.id === "w1")!;
    const pendientesAntes = await db.pendingOps.count();

    await gestion.anonimizarWorker(w, "Trabajador eliminado");

    const guardado = await db.workers.get("w1");
    expect(guardado?.name).toBe("Trabajador eliminado");
    expect(guardado?.alias).toBe("ELIMINADO-W1");
    expect(guardado?.qrCode).toBeUndefined();
    expect(guardado?.transporteCentimos).toBe(0);
    expect(guardado?.activo).toBe(0);
    expect(guardado?.deleted).toBe(0);
    expect(await db.pendingOps.count()).toBe(pendientesAntes + 1);

    // El histórico sigue resolviendo el nombre (genérico).
    const inf = await generarInformeTrabajador(guardado!);
    expect(inf.worker.name).toBe("Trabajador eliminado");
    expect(inf.totalDias).toBe(2);
  });
});
