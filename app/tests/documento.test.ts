import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import type { InformeAsistencia, InformeParte } from "@cuadrilla/shared/domain";
import { db } from "../src/lib/db/dexie";
import { i18n } from "../src/lib/i18n/i18n.svelte";
import { docAsistencia, docParte } from "../src/lib/export/documento";

const cab = {
  cuadrilla: "Cuadrilla 1",
  finca: "Finca La Loma",
  fecha: "2026-09-08",
  producto: "Naranja · Navelina",
  unidad: "Caja",
  firmante: "Paco Jefe",
};

beforeAll(async () => {
  await db.open();
  await i18n.cambiar("es");
});

describe("docAsistencia", () => {
  it("cabecera + una tabla por rol con columna Nº", () => {
    const inf: InformeAsistencia = {
      cabecera: cab,
      recolectores: ["Ana", "Beto"],
      auxiliares: ["Zoe"],
    };
    const d = docAsistencia(inf);

    expect(d.cabecera.map((c) => c.etiqueta)).toEqual([
      "Cuadrilla",
      "Finca",
      "Fecha",
      "Producto",
      "Unidad",
      "Firmado por",
    ]);
    expect(d.cabecera[2].valor).toBe("08/09/2026");
    expect(d.tablas.map((t) => t.titulo)).toEqual([
      "Recolectores (2)",
      "Auxiliares (1)",
    ]);
    expect(d.tablas[0].columnas.map((c) => c.align)).toEqual(["center", "left"]);
    expect(d.tablas[0].filas).toEqual([
      [1, "Ana"],
      [2, "Beto"],
    ]);
  });

  it("pasa las observaciones al documento", () => {
    const d = docAsistencia({
      cabecera: { ...cab, observaciones: "  Nota del día  " },
      recolectores: ["Ana"],
      auxiliares: [],
    });
    expect(d.observaciones).toBe("Nota del día");
  });

  it("añade Empresa y NIF a la cabecera cuando el perfil los tiene", () => {
    const d = docAsistencia({
      cabecera: { ...cab, empresa: "Cítricos SL", nif: "B12345678" },
      recolectores: ["Ana"],
      auxiliares: [],
    });
    expect(d.cabecera.slice(0, 3).map((c) => `${c.etiqueta}: ${c.valor}`)).toEqual([
      "Empresa: Cítricos SL",
      "NIF: B12345678",
      "Cuadrilla: Cuadrilla 1",
    ]);
  });
});

describe("docParte", () => {
  it("recolectores con unidades y fila de total", () => {
    const inf: InformeParte = {
      cabecera: cab,
      recolectores: [
        { nombre: "Ana", unidades: 40 },
        { nombre: "Beto", unidades: 25 },
      ],
      auxiliares: [{ nombre: "Zoe", tarea: "Carga", horas: 6 }],
      totalUnidades: 65,
    };
    const d = docParte(inf);

    const rec = d.tablas[0];
    expect(rec.columnas).toHaveLength(3);
    expect(rec.filas).toEqual([
      [1, "Ana", 40],
      [2, "Beto", 25],
    ]);
    expect(rec.total).toEqual(["", "TOTAL", 65]);

    const aux = d.tablas[1];
    expect(aux.filas).toEqual([["Zoe", "Carga", 6]]);
    expect(d.firmante).toBe("Paco Jefe");
  });

  it("nunca añade una tabla de grupos", () => {
    const inf: InformeParte = {
      cabecera: cab,
      recolectores: [
        { nombre: "Ana", unidades: 40 },
        { nombre: "Beto", unidades: 40 },
      ],
      auxiliares: [],
      totalUnidades: 80,
    };
    const d = docParte(inf);
    expect(d.tablas).toHaveLength(1);
    expect(d.tablas[0].titulo).toBe("Recolectores (2)");
    expect(d.tablas[0].filas).toEqual([
      [1, "Ana", 40],
      [2, "Beto", 40],
    ]);
    expect(d.tablas[0].total).toEqual(["", "TOTAL", 80]);
  });
});
