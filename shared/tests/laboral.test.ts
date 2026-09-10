import { describe, expect, it } from "vitest";
import {
  estadoAlta,
  faltanDatosAlta,
  normalizarLaboral,
} from "../src/domain/laboral";
import type { Worker } from "../src/types/worker";

function worker(p: Partial<Worker> = {}): Worker {
  return {
    id: "w1",
    organizationId: "o",
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

describe("laboral", () => {
  it("sin datos: alta pendiente y faltan los 4 mínimos", () => {
    const w = worker();
    expect(estadoAlta(w)).toBe("pendiente");
    expect(faltanDatosAlta(w)).toEqual([
      "dni",
      "numAfiliacionSS",
      "iban",
      "fechaAlta",
    ]);
  });

  it("con los 4 mínimos: alta completa (los opcionales no cuentan)", () => {
    const w = worker({
      laboral: {
        dni: "12345678Z",
        numAfiliacionSS: "281234567840",
        iban: "ES9121000418450200051332",
        fechaAlta: "2026-01-15",
      },
    });
    expect(estadoAlta(w)).toBe("completa");
    expect(faltanDatosAlta(w)).toEqual([]);
  });

  it("normalizarLaboral recorta y descarta vacíos, undefined si no queda nada", () => {
    expect(
      normalizarLaboral({ dni: "  12345678Z ", iban: "", categoria: undefined }),
    ).toEqual({ dni: "12345678Z" });
    expect(normalizarLaboral({ dni: "   ", iban: "" })).toBeUndefined();
  });
});
