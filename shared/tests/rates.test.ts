import { describe, expect, it } from "vitest";
import { resolverTarifa } from "../src/domain/rates";
import type { Rate } from "../src/types/rate";

function rate(p: Partial<Rate>): Rate {
  return {
    id: "r",
    organizationId: "o",
    productId: "p1",
    unitTypeId: "u1",
    amountPerUnit: 18,
    validFrom: "2026-01-01",
    validTo: null,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

describe("resolverTarifa", () => {
  it("elige la tarifa vigente en la fecha del turno", () => {
    const rates = [
      rate({ id: "a", validFrom: "2026-01-01", validTo: "2026-05-31" }),
      rate({ id: "b", validFrom: "2026-06-01", validTo: null }),
    ];
    expect(resolverTarifa(rates, "p1", "u1", "2026-03-10")?.id).toBe("a");
    expect(resolverTarifa(rates, "p1", "u1", "2026-07-01")?.id).toBe("b");
  });

  it("ante solapamiento gana la de validFrom mas reciente", () => {
    const rates = [
      rate({ id: "a", validFrom: "2026-01-01", validTo: null }),
      rate({ id: "b", validFrom: "2026-06-01", validTo: null }),
    ];
    expect(resolverTarifa(rates, "p1", "u1", "2026-09-01")?.id).toBe("b");
  });

  it("devuelve null si no hay tarifa aplicable", () => {
    const rates = [rate({ validFrom: "2026-06-01" })];
    expect(resolverTarifa(rates, "p1", "u1", "2026-01-01")).toBeNull();
    expect(resolverTarifa([], "p1", "u1", "2026-01-01")).toBeNull();
    expect(resolverTarifa(rates, "pX", "u1", "2026-07-01")).toBeNull();
  });

  it("ignora tarifas borradas", () => {
    expect(resolverTarifa([rate({ deleted: 1 })], "p1", "u1", "2026-07-01")).toBeNull();
  });
});
