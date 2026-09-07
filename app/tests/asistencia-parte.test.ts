import { describe, expect, it } from "vitest";
import type { InformeAsistencia } from "@cuadrilla/shared/domain";
import { textoAsistenciaParte } from "../src/lib/export/asistenciaParte";

function inf(p: Partial<InformeAsistencia> = {}): InformeAsistencia {
  return {
    cabecera: {
      cuadrilla: "Cuadrilla 1",
      fecha: "2026-09-07",
      producto: "Naranja",
      unidad: "Caja",
    },
    recolectores: [],
    auxiliares: [],
    grupos: [],
    ...p,
  };
}

describe("textoAsistenciaParte", () => {
  it("cabecera + lista numerada + total", () => {
    const t = textoAsistenciaParte(inf({ recolectores: ["Ana", "Beto", "Carlos"] }));
    expect(t).toBe(
      [
        "ASISTENCIA — Cuadrilla 1",
        "Fecha: 07/09/2026",
        "Producto: Naranja",
        "Unidad: Caja",
        "",
        "Trabajadores (3):",
        "1. Ana",
        "2. Beto",
        "3. Carlos",
      ].join("\n"),
    );
  });

  it("incluye la línea de finca cuando está presente", () => {
    const t = textoAsistenciaParte(
      inf({
        cabecera: {
          cuadrilla: "C1",
          fecha: "2026-09-07",
          finca: "Finca La Loma",
          producto: "Naranja",
          unidad: "Caja",
        },
        recolectores: ["Ana"],
      }),
    );
    const lineas = t.split("\n");
    expect(lineas[1]).toBe("Fecha: 07/09/2026");
    expect(lineas[2]).toBe("Finca: Finca La Loma");
  });

  it("sección de auxiliares y de grupos", () => {
    const t = textoAsistenciaParte(
      inf({
        recolectores: ["Ana", "Beto"],
        auxiliares: ["Marco", "Zoe"],
        grupos: [{ nombre: "Grupo A", miembros: ["Ana", "Beto"] }],
      }),
    );
    expect(t).toContain("Auxiliares (2):");
    expect(t).toContain("1. Marco");
    expect(t).toContain("Grupos:");
    expect(t).toContain("· Grupo A (2): Ana, Beto");
  });
});
