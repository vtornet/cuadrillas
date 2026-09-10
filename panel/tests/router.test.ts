import { describe, expect, it } from "vitest";
import { VISTAS } from "../src/lib/router.svelte";

describe("router del panel", () => {
  it("expone las vistas del panel", () => {
    expect(VISTAS.map((v) => v.id)).toEqual([
      "resumen",
      "cuadrillas",
      "trabajadores",
      "altas",
      "partes",
      "asistencia",
      "tarifas",
      "liquidacion",
      "equipo",
    ]);
  });
});
