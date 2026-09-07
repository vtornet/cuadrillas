import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Organization } from "@cuadrilla/shared";
import { LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import { db } from "../src/lib/db/dexie";
import { perfil } from "../src/lib/stores/perfil.svelte";
import { sesion } from "../src/lib/stores/sesion.svelte";

const ORG = sesion.organizationId;

const BASE: Organization = {
  id: ORG,
  organizationId: ORG,
  name: "Explotación X",
  plan: "foreman",
  planLimits: { ...LIMITES_PLAN_GRATIS },
  updatedAt: 1,
  deleted: 0,
};

describe("perfil store", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("guarda empresa y datos de contacto en la Organization sin tocar el plan", async () => {
    await db.organizations.put(BASE);
    await perfil.cargar();

    await perfil.guardar({
      empresa: "Cítricos del Sur SL",
      nombre: "Paco Jefe",
      telefono: "600123123",
      nif: "B12345678",
    });

    const guardada = await db.organizations.get(ORG);
    expect(guardada?.name).toBe("Cítricos del Sur SL");
    expect(guardada?.contactName).toBe("Paco Jefe");
    expect(guardada?.contactPhone).toBe("600123123");
    expect(guardada?.taxId).toBe("B12345678");
    expect(guardada?.plan).toBe("foreman");
    expect(perfil.nombreJefe).toBe("Paco Jefe");
    expect(await db.pendingOps.count()).toBe(1);
  });

  it("campos vacíos se guardan como undefined", async () => {
    await db.organizations.put({ ...BASE, contactName: "Antiguo" });
    await perfil.cargar();

    await perfil.guardar({ empresa: "Explotación X", nombre: "", telefono: "", nif: "" });

    const guardada = await db.organizations.get(ORG);
    expect(guardada?.contactName).toBeUndefined();
    expect(guardada?.name).toBe("Explotación X");
  });
});
