import { describe, expect, it } from "vitest";
import {
  fechaES,
  informeAsistencia,
  informeParte,
  type CabeceraInforme,
} from "../src/domain/parte";
import type { Entry } from "../src/types/entry";
import type { Shift } from "../src/types/shift";
import type { Worker } from "../src/types/worker";

const cab: CabeceraInforme = {
  cuadrilla: "Cuadrilla 1",
  finca: "Finca La Loma",
  fecha: "2026-09-07",
  producto: "Naranja · Navelina",
  unidad: "Caja",
};

function worker(id: string, name: string, p: Partial<Worker> = {}): Worker {
  return {
    id,
    organizationId: "o",
    name,
    alias: id,
    crewId: "c1",
    language: "es",
    activo: 1,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function entry(p: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    organizationId: "o",
    shiftId: "s1",
    workerId: "w1",
    cantidad: 1,
    timestamp: 1,
    registradoPor: "u1",
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

const shiftBase: Pick<Shift, "attendeeIds" | "groups" | "auxiliares"> = {
  attendeeIds: ["w1", "w2", "aux1"],
  groups: undefined,
  auxiliares: [{ workerId: "aux1", tarea: "Carga", horas: 6 }],
};

const workers = [
  worker("w2", "Beto"),
  worker("w1", "Ana"),
  worker("aux1", "Zoe", { funcion: "auxiliar" }),
  worker("w9", "Fuera"), // no está en attendeeIds
];

describe("informeAsistencia", () => {
  it("separa recolectores y auxiliares presentes, ordenados", () => {
    const r = informeAsistencia(cab, shiftBase, workers);
    expect(r.recolectores).toEqual(["Ana", "Beto"]);
    expect(r.auxiliares).toEqual(["Zoe"]);
  });

  it("los miembros de un grupo salen en la lista de recolectores, sin sección aparte", () => {
    const r = informeAsistencia(
      cab,
      {
        attendeeIds: ["w1", "w2"],
        groups: [{ groupId: "g1", name: "Grupo A", memberIds: ["w2", "w1"] }],
        auxiliares: undefined,
      },
      workers,
    );
    expect(r.recolectores).toEqual(["Ana", "Beto"]);
    expect("grupos" in r).toBe(false);
  });
});

describe("informeParte", () => {
  it("suma unidades por recolector y ordena por más unidades", () => {
    const entries = [
      entry({ workerId: "w1", cantidad: 30 }),
      entry({ workerId: "w1", cantidad: 10 }),
      entry({ workerId: "w2", cantidad: 50 }),
      entry({ workerId: "w2", cantidad: 5, deleted: 1 }),
    ];
    const r = informeParte(cab, shiftBase, workers, entries);
    expect(r.recolectores).toEqual([
      { nombre: "Beto", unidades: 50 },
      { nombre: "Ana", unidades: 40 },
    ]);
    expect(r.auxiliares).toEqual([{ nombre: "Zoe", tarea: "Carga", horas: 6 }]);
    expect("grupos" in r).toBe(false);
    expect(r.totalUnidades).toBe(90);
  });

  it("con grupos: reparte las unidades del grupo entre sus miembros", () => {
    const shift = {
      attendeeIds: ["w1", "w2"],
      groups: [{ groupId: "g1", name: "Grupo A", memberIds: ["w1", "w2"] }],
      auxiliares: undefined,
    };
    const entries = [
      entry({ workerId: undefined, groupId: "g1", cantidad: 80 }),
      entry({ workerId: "w1", cantidad: 10 }),
    ];
    const r = informeParte(cab, shift, workers, entries);
    expect(r.recolectores).toEqual([
      { nombre: "Ana", unidades: 50 },
      { nombre: "Beto", unidades: 40 },
    ]);
    expect(r.totalUnidades).toBe(90);
  });
});

describe("fechaES", () => {
  it("YYYY-MM-DD -> DD/MM/AAAA", () => {
    expect(fechaES("2026-09-07")).toBe("07/09/2026");
    expect(fechaES("raro")).toBe("raro");
  });
});
