import { describe, expect, it } from "vitest";
import { asistenciaMensual } from "../src/domain/attendance";
import type { Shift } from "../src/types/shift";
import type { Worker } from "../src/types/worker";

function worker(p: Partial<Worker>): Worker {
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
});
