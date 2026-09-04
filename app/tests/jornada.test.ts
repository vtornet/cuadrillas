import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Product, Shift, UnitType, Worker } from "@cuadrilla/shared";
import { db } from "../src/lib/db/dexie";
import { jornada } from "../src/lib/stores/jornada.svelte";

const WORKER: Worker = {
  id: "w1",
  organizationId: "o",
  name: "Ana",
  alias: "ANA",
  crewId: "c1",
  language: "es",
  activo: 1,
  updatedAt: 1,
  deleted: 0,
};

const SHIFT: Shift = {
  id: "s1",
  organizationId: "o",
  crewId: "c1",
  fecha: "2026-09-04",
  horaInicio: "08:00",
  horaFin: null,
  productId: "p1",
  unitTypeId: "u1",
  estado: "open",
  attendeeIds: ["w1"],
  updatedAt: 1,
  deleted: 0,
};

const PRODUCT: Product = {
  id: "p1",
  organizationId: "o",
  name: "Naranja",
  activo: 1,
  updatedAt: 1,
  deleted: 0,
};

const UNIT: UnitType = {
  id: "u1",
  organizationId: "o",
  name: "Caja",
  abbr: "cj",
  productId: "p1",
  updatedAt: 1,
  deleted: 0,
};

describe("jornada store", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.workers.put(WORKER);
    await db.shifts.put(SHIFT);
    await db.products.put(PRODUCT);
    await db.unitTypes.put(UNIT);
    await jornada.cargar();
  });

  it("sumar actualiza el conteo y encola una operacion por registro", async () => {
    await jornada.sumar("w1", 5);
    await jornada.sumar("w1", 3);

    expect(jornada.conteoDe("w1")).toBe(8);
    expect(jornada.total).toBe(8);
    expect(await db.pendingOps.count()).toBe(2);
  });

  it("deshacer revierte el ultimo registro de la sesion", async () => {
    await jornada.sumar("w1", 5);
    await jornada.sumar("w1", 2);

    await jornada.deshacer();
    expect(jornada.conteoDe("w1")).toBe(5);
    expect(jornada.puedeDeshacer).toBe(true);

    await jornada.deshacer();
    expect(jornada.conteoDe("w1")).toBe(0);
    expect(jornada.puedeDeshacer).toBe(false);
  });

  it("anularAnotacion descuenta y marca la anotacion como anulada", async () => {
    await jornada.sumar("w1", 10);
    const anotacion = jornada.entriesDeWorker("w1")[0];

    await jornada.anularAnotacion(anotacion.id);

    expect(jornada.conteoDe("w1")).toBe(0);
    expect(jornada.entriesDeWorker("w1")[0].deleted).toBe(1);
    const guardada = await db.entries.get(anotacion.id);
    expect(guardada?.deleted).toBe(1);
  });

  it("guardarTrabajador actualiza el trabajador y lo persiste", async () => {
    await jornada.guardarTrabajador("w1", {
      name: "Ana Ruiz",
      alias: "ANAR",
      language: "en",
      activo: 1,
    });

    expect(jornada.workers[0].name).toBe("Ana Ruiz");
    const guardado = await db.workers.get("w1");
    expect(guardado?.name).toBe("Ana Ruiz");
    expect(guardado?.language).toBe("en");
  });
});
