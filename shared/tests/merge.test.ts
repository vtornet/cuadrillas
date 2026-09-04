import { describe, expect, it } from "vitest";
import { entranteGana, fusionar } from "../src/domain/merge";
import type { Entry } from "../src/types/entry";

function entry(p: Partial<Entry>): Entry {
  return {
    id: "e1",
    organizationId: "o",
    shiftId: "s",
    workerId: "w",
    cantidad: 1,
    timestamp: 1,
    registradoPor: "u",
    updatedAt: 1000,
    deleted: 0,
    ...p,
  };
}

describe("entranteGana (LWW)", () => {
  it("gana si no hay version local", () => {
    expect(entranteGana({ updatedAt: 1 }, undefined)).toBe(true);
    expect(entranteGana({ updatedAt: 1 }, null)).toBe(true);
  });

  it("gana la version mas reciente", () => {
    expect(entranteGana({ updatedAt: 2000 }, { updatedAt: 1000 })).toBe(true);
    expect(entranteGana({ updatedAt: 1000 }, { updatedAt: 2000 })).toBe(false);
  });

  it("en empate gana el entrante", () => {
    expect(entranteGana({ updatedAt: 1000 }, { updatedAt: 1000 })).toBe(true);
  });
});

describe("fusionar", () => {
  it("elige la version ganadora sin mutar", () => {
    const local = entry({ cantidad: 5, updatedAt: 1000 });
    const entrante = entry({ cantidad: 8, updatedAt: 2000 });
    expect(fusionar(entrante, local)).toBe(entrante);
    expect(fusionar(entry({ cantidad: 3, updatedAt: 500 }), local)).toBe(local);
  });

  it("una lapida mas reciente gana a una edicion anterior", () => {
    const local = entry({ cantidad: 5, updatedAt: 1000, deleted: 0 });
    const borrado = entry({ cantidad: 5, updatedAt: 1500, deleted: 1 });
    expect(fusionar(borrado, local).deleted).toBe(1);
  });

  it("una lapida antigua no gana a una edicion posterior", () => {
    const borradoViejo = entry({ updatedAt: 1000, deleted: 1 });
    const edicion = entry({ updatedAt: 2000, deleted: 0, cantidad: 9 });
    expect(fusionar(borradoViejo, edicion).deleted).toBe(0);
  });
});
