import { describe, expect, it } from "vitest";
import { textoAsistenciaParte } from "../src/lib/export/asistenciaParte";

describe("textoAsistenciaParte", () => {
  it("cabecera + lista numerada ordenada por nombre + total", () => {
    const t = textoAsistenciaParte({
      cuadrilla: "Cuadrilla 1",
      fecha: "2026-09-07",
      producto: "Naranja",
      unidad: "Caja",
      nombres: ["Beto", "Ana", "Carlos"],
    });
    expect(t).toBe(
      [
        "ASISTENCIA — Cuadrilla 1",
        "Fecha: 07/09/2026",
        "Producto: Naranja · Caja",
        "",
        "Trabajadores (3):",
        "1. Ana",
        "2. Beto",
        "3. Carlos",
      ].join("\n"),
    );
  });

  it("añade el desglose de grupos si el parte se trabaja por grupos", () => {
    const t = textoAsistenciaParte({
      cuadrilla: "C1",
      fecha: "2026-09-07",
      producto: "Fresa",
      unidad: "Kilo",
      nombres: ["Ana", "Beto"],
      grupos: [
        { nombre: "Grupo B", miembros: ["Beto"] },
        { nombre: "Grupo A", miembros: ["Ana"] },
      ],
    });
    expect(t).toContain("Grupos:");
    expect(t).toContain("· Grupo B (1): Beto");
    expect(t).toContain("· Grupo A (1): Ana");
  });

  it("lista los auxiliares en su propia sección", () => {
    const t = textoAsistenciaParte({
      cuadrilla: "C1",
      fecha: "2026-09-07",
      producto: "Naranja",
      unidad: "Caja",
      nombres: ["Ana", "Beto"],
      auxiliares: ["Zoe", "Marco"],
    });
    expect(t).toContain("Trabajadores (2):");
    expect(t).toContain("Auxiliares (2):");
    const lineas = t.split("\n");
    expect(lineas).toContain("Auxiliares (2):");
    expect(lineas).toContain("1. Marco");
    expect(lineas).toContain("2. Zoe");
  });

  it("omite la línea de producto si no hay datos", () => {
    const t = textoAsistenciaParte({
      cuadrilla: "C1",
      fecha: "2026-09-07",
      producto: "",
      unidad: "",
      nombres: ["Ana"],
    });
    expect(t).not.toContain("Producto:");
  });
});
