import { describe, expect, it } from "vitest";
import { calcularEstadisticas, horasDeJornada } from "../src/domain/stats";
import type { Entry } from "../src/types/entry";
import type { Shift } from "../src/types/shift";
import type { Worker } from "../src/types/worker";

function shift(p: Partial<Shift>): Shift {
  return {
    id: "s1",
    organizationId: "o",
    crewId: "c1",
    fecha: "2026-09-01",
    horaInicio: "08:00",
    horaFin: "16:00",
    productId: "p1",
    unitTypeId: "u1",
    estado: "closed",
    attendeeIds: ["w1", "w2"],
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

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
    id: Math.random().toString(36),
    organizationId: "o",
    shiftId: "s1",
    workerId: "w1",
    cantidad: 1,
    timestamp: 1,
    registradoPor: "u",
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

describe("horasDeJornada", () => {
  it("calcula la diferencia horaInicio-horaFin", () => {
    expect(horasDeJornada({ horaInicio: "08:00", horaFin: "16:00" })).toBe(8);
    expect(horasDeJornada({ horaInicio: "07:30", horaFin: "13:00" })).toBe(5.5);
  });

  it("jornada abierta cuenta hasta ahoraMin", () => {
    expect(horasDeJornada({ horaInicio: "08:00", horaFin: null }, 12 * 60)).toBe(4);
    expect(horasDeJornada({ horaInicio: "08:00", horaFin: null }, 20 * 60)).toBe(12);
  });

  it("sin horaInicio devuelve 0", () => {
    expect(horasDeJornada({ horaInicio: null, horaFin: "16:00" })).toBe(0);
  });
});

describe("calcularEstadisticas", () => {
  const s = shift({});
  const workers = [worker("w1", "Ana"), worker("w2", "Beto")];

  it("agrega unidades por trabajador y ordena el ranking", () => {
    const entries = [
      entry({ workerId: "w1", cantidad: 30 }),
      entry({ workerId: "w1", cantidad: 10 }),
      entry({ workerId: "w2", cantidad: 25 }),
      entry({ workerId: "w2", cantidad: 5, deleted: 1 }),
    ];
    const r = calcularEstadisticas([s], workers, entries);

    expect(r.filas.map((f) => f.workerId)).toEqual(["w1", "w2"]);
    expect(r.filas[0]).toMatchObject({ name: "Ana", unidades: 40, horas: 8, unidadesPorHora: 5 });
    expect(r.filas[1].unidades).toBe(25);
    expect(r.totalUnidades).toBe(65);
    expect(r.mediaUnidades).toBe(32.5);
    expect(r.totalHoras).toBe(16);
    expect(r.mediaUnidadesPorHora).toBe(4.06); // 65/16 redondeado a 2 decimales
  });

  it("los auxiliares no entran en el ranking, medias ni horas", () => {
    const conAux = [
      worker("w1", "Ana"),
      worker("w2", "Beto"),
      worker("aux", "Carga", { funcion: "auxiliar" }),
    ];
    const shiftConAux = shift({ attendeeIds: ["w1", "w2", "aux"] });
    const entries = [
      entry({ workerId: "w1", cantidad: 40 }),
      entry({ workerId: "w2", cantidad: 20 }),
    ];
    const r = calcularEstadisticas([shiftConAux], conAux, entries);

    expect(r.filas.map((f) => f.workerId)).toEqual(["w1", "w2"]);
    expect(r.totalHoras).toBe(16); // 8h x 2 recolectores, sin el auxiliar
    expect(r.numTrabajadores).toBe(2);
  });

  it("reparte las anotaciones de grupo a partes iguales entre sus miembros", () => {
    const ws = [worker("w1", "Ana"), worker("w2", "Beto"), worker("w3", "Cira")];
    const s = shift({
      attendeeIds: ["w1", "w2", "w3"],
      groups: [{ groupId: "g1", name: "Grupo A", memberIds: ["w1", "w2", "w3"] }],
    });
    const entries = [
      entry({ groupId: "g1", workerId: undefined, cantidad: 90 }),
      entry({ workerId: "w1", cantidad: 12 }), // Ana además registra individual
    ];
    const r = calcularEstadisticas([s], ws, entries);

    const porId = Object.fromEntries(r.filas.map((f) => [f.workerId, f.unidades]));
    expect(porId.w1).toBe(42); // 30 del grupo + 12 individual
    expect(porId.w2).toBe(30);
    expect(porId.w3).toBe(30);
    expect(r.totalUnidades).toBe(102);
  });

  it("reparto de grupo con decimales (100 / 3)", () => {
    const ws = [worker("w1", "Ana"), worker("w2", "Beto"), worker("w3", "Cira")];
    const s = shift({
      attendeeIds: ["w1", "w2", "w3"],
      groups: [{ groupId: "g1", name: "G", memberIds: ["w1", "w2", "w3"] }],
    });
    const r = calcularEstadisticas(
      [s],
      ws,
      [entry({ groupId: "g1", workerId: undefined, cantidad: 100 })],
    );
    expect(r.filas.every((f) => f.unidades === 33.3)).toBe(true);
    expect(r.totalUnidades).toBe(100);
  });

  it("evolucion diaria suma por fecha y ordena", () => {
    const s1 = shift({ id: "s1", fecha: "2026-09-02" });
    const s2 = shift({ id: "s2", fecha: "2026-09-01" });
    const entries = [
      entry({ shiftId: "s1", workerId: "w1", cantidad: 10 }),
      entry({ shiftId: "s2", workerId: "w1", cantidad: 4 }),
      entry({ shiftId: "s2", workerId: "w2", cantidad: 6 }),
    ];
    const r = calcularEstadisticas([s1, s2], workers, entries);
    expect(r.evolucion).toEqual([
      { fecha: "2026-09-01", unidades: 10 },
      { fecha: "2026-09-02", unidades: 10 },
    ]);
  });

  it("ignora entries de jornadas no incluidas", () => {
    const entries = [entry({ shiftId: "otra", workerId: "w1", cantidad: 99 })];
    const r = calcularEstadisticas([s], workers, entries);
    expect(r.totalUnidades).toBe(0);
  });
});
