import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Crew, Worker } from "@cuadrilla/shared";
import {
  construirWorkers,
  parsearArchivoWorkers,
  type ContextoImport,
} from "../src/lib/import/workers";

const ORG = "org-1";

function crew(p: Partial<Crew> = {}): Crew {
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

function worker(p: Partial<Worker> = {}): Worker {
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

function ctx(p: Partial<ContextoImport> = {}): ContextoImport {
  return {
    crews: [crew({ id: "c1", name: "Cuadrilla Norte" })],
    existentes: [],
    organizationId: ORG,
    ...p,
  };
}

describe("construirWorkers", () => {
  it("mapea cabeceras con acentos/mayusculas y crea trabajadores", () => {
    const matriz = [
      ["Nombre", "Alias", "Cuadrilla", "Idioma", "Transporte"],
      ["Juan Pérez", "JUAN", "Cuadrilla Norte", "es", "5,00"],
      ["María López", "MARIA", "cuadrilla norte", "Inglés", "3"],
    ];
    const r = construirWorkers(matriz, ctx());

    expect(r.errores).toHaveLength(0);
    expect(r.validos).toHaveLength(2);
    expect(r.validos[0]).toMatchObject({
      name: "Juan Pérez",
      alias: "JUAN",
      crewId: "c1",
      language: "es",
      transporteCentimos: 500,
      activo: 1,
      organizationId: ORG,
      deleted: 0,
    });
    expect(r.validos[1]).toMatchObject({
      name: "María López",
      language: "en",
      transporteCentimos: 300,
    });
    expect(r.validos[0].id).not.toBe(r.validos[1].id);
  });

  it("usa la unica cuadrilla y el nombre como alias cuando faltan", () => {
    const matriz = [["Nombre"], ["Solo Nombre"]];
    const r = construirWorkers(matriz, ctx());
    expect(r.validos[0]).toMatchObject({
      name: "Solo Nombre",
      alias: "Solo Nombre",
      crewId: "c1",
      language: "es",
      transporteCentimos: 0,
    });
  });

  it("marca activo=0 con valores negativos", () => {
    const matriz = [
      ["Nombre", "Activo"],
      ["A", "no"],
      ["B", "sí"],
    ];
    const r = construirWorkers(matriz, ctx());
    expect(r.validos.map((w) => w.activo)).toEqual([0, 1]);
  });

  it("reporta filas sin nombre, cuadrilla desconocida e importe invalido", () => {
    const matriz = [
      ["Nombre", "Cuadrilla", "Transporte"],
      ["", "Cuadrilla Norte", ""],
      ["Pedro", "Cuadrilla Sur", ""],
      ["Lucía", "Cuadrilla Norte", "abc"],
      ["Marcos", "Cuadrilla Norte", ""],
    ];
    const r = construirWorkers(
      matriz,
      ctx({
        crews: [
          crew({ id: "c1", name: "Cuadrilla Norte" }),
          crew({ id: "c2", name: "Cuadrilla Sur (baja)" }),
        ],
      }),
    );

    expect(r.validos).toHaveLength(1);
    expect(r.validos[0].name).toBe("Marcos");
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4]);
    expect(r.errores[0].motivo).toMatch(/nombre/i);
    expect(r.errores[1].motivo).toMatch(/no encontrada/i);
    expect(r.errores[2].motivo).toMatch(/importe/i);
  });

  it("exige indicar cuadrilla cuando hay varias", () => {
    const matriz = [["Nombre"], ["Sin cuadrilla"]];
    const r = construirWorkers(
      matriz,
      ctx({ crews: [crew({ id: "c1" }), crew({ id: "c2", name: "Otra" })] }),
    );
    expect(r.validos).toHaveLength(0);
    expect(r.errores[0].motivo).toMatch(/cuadrilla/i);
  });

  it("detecta alias duplicado (existente y dentro del propio archivo)", () => {
    const matriz = [
      ["Nombre", "Alias"],
      ["Ana Nueva", "ANA"],
      ["Beto", "BETO"],
      ["Beto Dos", "beto"],
    ];
    const r = construirWorkers(
      matriz,
      ctx({ existentes: [worker({ alias: "ANA", crewId: "c1" })] }),
    );
    expect(r.validos.map((w) => w.name)).toEqual(["Beto"]);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 4]);
  });

  it("falla si no hay columna Nombre", () => {
    const r = construirWorkers([["Alias", "Cuadrilla"], ["X", "Y"]], ctx());
    expect(r.validos).toHaveLength(0);
    expect(r.errores[0].motivo).toMatch(/Nombre/);
  });
});

describe("parsearArchivoWorkers (round-trip)", () => {
  it("lee un .xlsx real", async () => {
    const aoa = [
      ["Nombre", "Alias", "Cuadrilla", "Transporte"],
      ["Juan Pérez", "JUAN", "Cuadrilla Norte", "5,00"],
      ["María López", "MARIA", "Cuadrilla Norte", "4,50"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Trabajadores");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([buf], "trabajadores.xlsx");

    const r = await parsearArchivoWorkers(file, ctx());
    expect(r.errores).toHaveLength(0);
    expect(r.validos.map((w) => w.name)).toEqual(["Juan Pérez", "María López"]);
    expect(r.validos.map((w) => w.transporteCentimos)).toEqual([500, 450]);
  });

  it("lee un .csv", async () => {
    const csv = "Nombre,Alias,Cuadrilla\nJuan,JUAN,Cuadrilla Norte\nMaria,MARIA,Cuadrilla Norte\n";
    const file = new File([csv], "trabajadores.csv", { type: "text/csv" });

    const r = await parsearArchivoWorkers(file, ctx());
    expect(r.errores).toHaveLength(0);
    expect(r.validos.map((w) => w.alias)).toEqual(["JUAN", "MARIA"]);
  });
});
