import { describe, expect, it } from "vitest";
import { asistenciaMensual } from "../src/domain/attendance";
import type { Entry } from "../src/types/entry";
import type { Shift } from "../src/types/shift";
import type { Worker } from "../src/types/worker";

function worker(p: Partial<Worker>): Worker {
  return {
    id: "w1",
    organizationId: "o",
    name: "Ana",
    alias: "ANA",
    crewId: "c1",
    activo: 1,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function shift(p: Partial<Shift>): Shift {
  return {
    id: crypto.randomUUID(),
    organizationId: "o",
    crewId: "c1",
    fecha: "2026-09-01",
    horaInicio: "08:00",
    horaFin: "14:00",
    productId: "p1",
    unitTypeId: "u1",
    estado: "closed",
    attendeeIds: [],
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

describe("asistenciaMensual", () => {
  it("construye la rejilla de días y marca la asistencia", () => {
    const workers = [
      worker({ id: "w1", name: "Ana" }),
      worker({ id: "w2", name: "Beto" }),
    ];
    const shifts = [
      shift({ fecha: "2026-09-01", attendeeIds: ["w1", "w2"] }),
      shift({ fecha: "2026-09-02", attendeeIds: ["w1"] }),
      // dos partes el mismo día: unión de asistencia
      shift({ fecha: "2026-09-03", attendeeIds: ["w2"] }),
      shift({ fecha: "2026-09-03", attendeeIds: ["w1"] }),
      // otro mes: se ignora
      shift({ fecha: "2026-08-15", attendeeIds: ["w1", "w2"] }),
    ];

    const a = asistenciaMensual(shifts, workers, 2026, 9);

    expect(a.dias).toHaveLength(30);
    expect(a.dias[0]).toMatchObject({ dia: 1, fecha: "2026-09-01", diaSemana: 1 });
    // 2026-09-05 es sábado
    expect(a.dias[4]).toMatchObject({ dia: 5, finDeSemana: true });

    const ana = a.filas.find((f) => f.workerId === "w1")!;
    const beto = a.filas.find((f) => f.workerId === "w2")!;
    expect(ana.presente.slice(0, 3)).toEqual([true, true, true]);
    expect(ana.total).toBe(3);
    expect(beto.presente.slice(0, 3)).toEqual([true, false, true]);
    expect(beto.total).toBe(2);

    expect(a.totalPorDia.slice(0, 3)).toEqual([2, 1, 2]);
    expect(a.totalGeneral).toBe(5);
  });

  it("ordena por nombre e incluye inactivos solo si trabajaron ese mes", () => {
    const workers = [
      worker({ id: "w1", name: "Zoe", activo: 1 }),
      worker({ id: "w2", name: "Ana", activo: 0 }), // inactivo sin actividad
      worker({ id: "w3", name: "Marta", activo: 0 }), // inactivo con actividad
      worker({ id: "w4", name: "Bruno", deleted: 1 }), // borrado: fuera
    ];
    const shifts = [shift({ fecha: "2026-09-10", attendeeIds: ["w3", "w4"] })];

    const a = asistenciaMensual(shifts, workers, 2026, 9);
    expect(a.filas.map((f) => f.name)).toEqual(["Marta", "Zoe"]);
  });

  it("febrero de año bisiesto tiene 29 días", () => {
    const a = asistenciaMensual([], [], 2028, 2);
    expect(a.dias).toHaveLength(29);
  });

  it("ordena recolectores antes que auxiliares y desglosa totales por rol", () => {
    const workers = [
      worker({ id: "w1", name: "Zoe" }),
      worker({ id: "w2", name: "Ana", funcion: "auxiliar" }),
      worker({ id: "w3", name: "Marta" }),
    ];
    const shifts = [
      shift({ fecha: "2026-09-01", attendeeIds: ["w1", "w2", "w3"] }),
    ];
    const a = asistenciaMensual(shifts, workers, 2026, 9);

    expect(a.filas.map((f) => f.name)).toEqual(["Marta", "Zoe", "Ana"]);
    expect(a.filas.map((f) => f.funcion)).toEqual([
      "recolector",
      "recolector",
      "auxiliar",
    ]);
    expect(a.totalPorDiaRol.recolector[0]).toBe(2);
    expect(a.totalPorDiaRol.auxiliar[0]).toBe(1);
    expect(a.totalPorDia[0]).toBe(3);
  });

  it("distingue presente-y-anotó de presente-sin-anotar", () => {
    const s1: Shift = {
      ...shift({ id: "s1", fecha: "2026-09-01", attendeeIds: ["w1", "w2"] }),
    };
    const s2: Shift = {
      ...shift({
        id: "s2",
        fecha: "2026-09-02",
        attendeeIds: ["w1", "w3"],
        groups: [{ groupId: "g1", name: "G", memberIds: ["w1", "w3"] }],
      }),
    };
    const workers = [
      worker({ id: "w1", name: "Ana" }),
      worker({ id: "w2", name: "Beto" }),
      worker({ id: "w3", name: "Cira", funcion: "auxiliar" }),
    ];
    const entries: Entry[] = [
      {
        id: "e1",
        organizationId: "o",
        shiftId: "s1",
        workerId: "w1",
        cantidad: 3,
        timestamp: 1,
        registradoPor: "u1",
        updatedAt: 1,
        deleted: 0,
      },
      {
        id: "e2",
        organizationId: "o",
        shiftId: "s2",
        groupId: "g1",
        cantidad: 8,
        timestamp: 1,
        registradoPor: "u1",
        updatedAt: 1,
        deleted: 0,
      },
    ];
    // s2 tiene a Cira (auxiliar) con tarea → cuenta como anotación
    s2.auxiliares = [{ workerId: "w3", tarea: "Carga" }];

    const a = asistenciaMensual([s1, s2], workers, 2026, 9, entries);
    const ana = a.filas.find((f) => f.name === "Ana")!;
    const beto = a.filas.find((f) => f.name === "Beto")!;
    const cira = a.filas.find((f) => f.name === "Cira")!;

    expect(ana.conAnotacion.slice(0, 2)).toEqual([true, true]); // registro + grupo
    expect(ana.sinAnotar).toBe(0);
    expect(beto.presente[0]).toBe(true);
    expect(beto.conAnotacion[0]).toBe(false); // presente sin anotar
    expect(beto.sinAnotar).toBe(1);
    expect(cira.conAnotacion[1]).toBe(true); // auxiliar con tarea
    expect(a.totalSinAnotar).toBe(1);
  });

  it("un parte 'por horas' cuenta como anotación para el recolector con horas", () => {
    const s: Shift = {
      ...shift({
        id: "s1",
        fecha: "2026-09-01",
        attendeeIds: ["w1", "w2"],
        modo: "horas",
        horasRecolectores: [{ workerId: "w1", horas: 8 }],
      }),
    };
    const workers = [
      worker({ id: "w1", name: "Ana" }),
      worker({ id: "w2", name: "Beto" }),
    ];
    const a = asistenciaMensual([s], workers, 2026, 9);
    const ana = a.filas.find((f) => f.name === "Ana")!;
    const beto = a.filas.find((f) => f.name === "Beto")!;
    expect(ana.conAnotacion[0]).toBe(true);
    expect(beto.presente[0]).toBe(true);
    expect(beto.conAnotacion[0]).toBe(false); // presente pero sin horas anotadas
  });

  it("recoge las fincas trabajadas por día y del mes", () => {
    const shifts = [
      shift({ fecha: "2026-09-01", attendeeIds: ["w1"], finca: "El Cerro" }),
      shift({ fecha: "2026-09-01", attendeeIds: ["w1"], finca: "La Loma" }),
      shift({ fecha: "2026-09-02", attendeeIds: ["w1"], finca: "El Cerro" }),
    ];
    const a = asistenciaMensual(shifts, [worker({ id: "w1" })], 2026, 9);
    expect(a.fincasPorDia[0]).toEqual(["El Cerro", "La Loma"]);
    expect(a.fincasPorDia[1]).toEqual(["El Cerro"]);
    expect(a.fincas).toEqual(["El Cerro", "La Loma"]);
  });
});
