import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Product, Rate } from "@cuadrilla/shared";
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
});
