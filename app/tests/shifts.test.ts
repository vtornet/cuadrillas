import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Crew, Product, UnitType, Worker } from "@cuadrilla/shared";
import { db } from "../src/lib/db/dexie";
import { crearShift, jornadasAbiertas } from "../src/lib/db/repositories/shifts";
import { getMeta } from "../src/lib/db/meta";
import { jornada } from "../src/lib/stores/jornada.svelte";

const CREW: Crew = {
  id: "c1",
  organizationId: "o",
  name: "Cuadrilla 1",
  foremanIds: ["u1"],
  updatedAt: 1,
  deleted: 0,
};

const WORKERS: Worker[] = [
  {
    id: "w1",
    organizationId: "o",
    name: "Ana",
    alias: "ANA",
    crewId: "c1",
    language: "es",
    activo: 1,
    updatedAt: 1,
    deleted: 0,
  },
  {
    id: "w2",
    organizationId: "o",
    name: "Beto",
    alias: "BETO",
    crewId: "c1",
    language: "es",
    activo: 1,
    updatedAt: 1,
    deleted: 0,
  },
];

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

function nuevaInput() {
  return {
    organizationId: "o",
    crewId: "c1",
    productId: "p1",
    unitTypeId: "u1",
    fecha: "2026-09-04",
    horaInicio: "08:00",
    attendeeIds: ["w1", "w2"],
  };
}

describe("apertura y cierre de jornada", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.crews.put(CREW);
    await db.workers.bulkPut(WORKERS);
    await db.products.put(PRODUCT);
    await db.unitTypes.put(UNIT);
  });

  it("crearShift crea una jornada abierta y encola la operacion", async () => {
    const s = await crearShift(nuevaInput());

    expect(s.estado).toBe("open");
    expect(s.horaFin).toBeNull();
    expect(await jornadasAbiertas()).toHaveLength(1);
    expect(await db.pendingOps.count()).toBe(1);
  });

  it("activar fija la jornada activa y cargar la resuelve", async () => {
    const s = await crearShift(nuevaInput());
    await jornada.activar(s.id);

    expect(jornada.shift?.id).toBe(s.id);
    expect(jornada.workers.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(await getMeta<string>("activeShiftId")).toBe(s.id);
  });

  it("cerrarActual cierra la jornada y deja de estar activa", async () => {
    const s = await crearShift(nuevaInput());
    await jornada.activar(s.id);
    await jornada.cerrarActual();

    expect(jornada.hayJornada).toBe(false);
    const guardada = await db.shifts.get(s.id);
    expect(guardada?.estado).toBe("closed");
    expect(guardada?.horaFin).not.toBeNull();
    // el array de asistentes debe persistir como array plano, no como proxy
    expect(Array.isArray(guardada?.attendeeIds)).toBe(true);
    expect(guardada?.attendeeIds).toEqual(["w1", "w2"]);
    expect(await getMeta<string>("activeShiftId")).toBeUndefined();
  });

  it("cargar cae a la jornada abierta mas reciente si no hay activa fijada", async () => {
    const s = await crearShift(nuevaInput());
    await jornada.cargar();

    expect(jornada.shift?.id).toBe(s.id);
    expect(await getMeta<string>("activeShiftId")).toBe(s.id);
  });

  it("cerrarActual guarda la firma cuando se pasa una", async () => {
    const s = await crearShift(nuevaInput());
    await jornada.activar(s.id);
    await jornada.cerrarActual("data:image/png;base64,abc123");

    const guardada = await db.shifts.get(s.id);
    expect(guardada?.firma).toBe("data:image/png;base64,abc123");
  });

  it("cerrarActual sin firma no guarda el campo", async () => {
    const s = await crearShift(nuevaInput());
    await jornada.activar(s.id);
    await jornada.cerrarActual();

    const guardada = await db.shifts.get(s.id);
    expect(guardada?.firma).toBeUndefined();
  });
});
