import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Crew, Group, Product, Rate, Worker } from "@cuadrilla/shared";
import { db } from "../src/lib/db/dexie";
import { gestion } from "../src/lib/stores/gestion.svelte";
import { sesion } from "../src/lib/stores/sesion.svelte";

const ORG = sesion.organizationId;

function producto(p: Partial<Product> = {}): Product {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    name: "Naranja",
    activo: 1,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function cuadrilla(p: Partial<Crew> = {}): Crew {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    name: "Cuadrilla Norte",
    foremanIds: ["u1"],
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function trabajador(p: Partial<Worker> = {}): Worker {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    name: "Ana",
    alias: "ANA",
    crewId: "c1",
    language: "es",
    activo: 1,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function grupo(p: Partial<Group> = {}): Group {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    name: "Grupo A",
    crewId: "c1",
    memberIds: [],
    activo: 1,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

describe("gestion store CRUD", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await gestion.cargar();
  });

  it("guardar crea, actualiza y encola cada cambio", async () => {
    const p = producto();
    await gestion.guardar("product", p);
    expect(gestion.products.map((x) => x.id)).toContain(p.id);
    expect(await db.pendingOps.count()).toBe(1);

    const renombrado: Product = { ...p, name: "Naranja tardia" };
    await gestion.guardar("product", renombrado);
    expect(gestion.products.find((x) => x.id === p.id)?.name).toBe(
      "Naranja tardia",
    );
    expect(await db.pendingOps.count()).toBe(2);
  });

  it("eliminar marca lapida y lo saca de la lista", async () => {
    const p = producto({ id: "p1" });
    await gestion.guardar("product", p);
    await gestion.eliminar("product", p);

    expect(gestion.products.find((x) => x.id === "p1")).toBeUndefined();
    const guardado = await db.products.get("p1");
    expect(guardado?.deleted).toBe(1);
  });

  it("guarda una tarifa con importe en centimos", async () => {
    const r: Rate = {
      id: "r1",
      organizationId: ORG,
      productId: "p1",
      unitTypeId: "u1",
      amountPerUnit: 18,
      validFrom: "2026-01-01",
      validTo: null,
      updatedAt: 1,
      deleted: 0,
    };
    await gestion.guardar("rate", r);

    const guardada = await db.rates.get("r1");
    expect(guardada?.amountPerUnit).toBe(18);
    expect(gestion.rates).toHaveLength(1);
  });

  it("crea una cuadrilla y aparece en la lista", async () => {
    const c = cuadrilla({ id: "c1" });
    await gestion.guardar("crew", c);
    expect(gestion.crews.map((x) => x.id)).toContain("c1");
    expect(gestion.nombreCrew("c1")).toBe("Cuadrilla Norte");
  });

  it("trabajadoresDe devuelve los trabajadores de esa cuadrilla", async () => {
    await gestion.guardar("crew", cuadrilla({ id: "c1" }));
    await gestion.guardar("worker", trabajador({ id: "w1", crewId: "c1" }));
    await gestion.guardar("worker", trabajador({ id: "w2", crewId: "c1" }));
    await gestion.guardar("worker", trabajador({ id: "w3", crewId: "otra" }));

    expect(gestion.trabajadoresDe("c1").map((w) => w.id).sort()).toEqual([
      "w1",
      "w2",
    ]);
  });

  it("eliminar una cuadrilla la saca de la lista", async () => {
    const c = cuadrilla({ id: "c1" });
    await gestion.guardar("crew", c);
    await gestion.eliminar("crew", c);

    expect(gestion.crews.find((x) => x.id === "c1")).toBeUndefined();
    const guardada = await db.crews.get("c1");
    expect(guardada?.deleted).toBe(1);
  });

  it("crea un grupo y aparece en gruposDe su cuadrilla", async () => {
    await gestion.guardar("crew", cuadrilla({ id: "c1" }));
    await gestion.guardar("worker", trabajador({ id: "w1", crewId: "c1" }));
    await gestion.guardar("worker", trabajador({ id: "w2", crewId: "c1" }));
    const g = grupo({ id: "g1", crewId: "c1", memberIds: ["w1", "w2"] });
    await gestion.guardar("group", g);

    expect(gestion.groups.map((x) => x.id)).toContain("g1");
    expect(gestion.gruposDe("c1").map((x) => x.id)).toEqual(["g1"]);
  });

  it("eliminar un grupo lo saca de la lista sin tocar sus miembros", async () => {
    await gestion.guardar("crew", cuadrilla({ id: "c1" }));
    await gestion.guardar("worker", trabajador({ id: "w1", crewId: "c1" }));
    const g = grupo({ id: "g1", crewId: "c1", memberIds: ["w1"] });
    await gestion.guardar("group", g);
    await gestion.eliminar("group", g);

    expect(gestion.groups.find((x) => x.id === "g1")).toBeUndefined();
    const guardado = await db.groups.get("g1");
    expect(guardado?.deleted).toBe(1);
    expect(gestion.trabajadoresDe("c1").map((w) => w.id)).toEqual(["w1"]);
  });
});
