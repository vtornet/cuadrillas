import { describe, expect, it } from "vitest";
import { calcularLiquidacion } from "../src/domain/settlement";
import type { Entry } from "../src/types/entry";
import type { Rate } from "../src/types/rate";
import type { Shift } from "../src/types/shift";
import type { Worker } from "../src/types/worker";

function shift(p: Partial<Shift>): Shift {
  return {
    id: "s1",
    organizationId: "o",
    crewId: "c1",
    fecha: "2026-09-10",
    horaInicio: "08:00",
    horaFin: "16:00",
    productId: "p1",
    unitTypeId: "u1",
    estado: "closed",
    attendeeIds: ["w1"],
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function worker(id: string, name: string, p: Partial<Worker> = {}): Worker {
  return {
    id, organizationId: "o", name, alias: id, crewId: "c1",
    activo: 1, updatedAt: 1, deleted: 0, ...p,
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

function rate(p: Partial<Rate>): Rate {
  return {
    id: Math.random().toString(36),
    organizationId: "o",
    productId: "p1",
    unitTypeId: "u1",
    amountPerUnit: 18,
    validFrom: "2026-01-01",
    validTo: null,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };

describe("calcularLiquidacion", () => {
  it("importe = unidades x tarifa vigente, en centimos", () => {
    const liq = calcularLiquidacion(
      [shift({})],
      [worker("w1", "Ana")],
      [entry({ cantidad: 100 }), entry({ cantidad: 20 })],
      [rate({ amountPerUnit: 18 })],
      RANGO,
    );
    const t = liq.trabajadores[0];
    expect(t.totalUnidades).toBe(120);
    expect(t.importeCentimos).toBe(120 * 18);
    expect(t.transporteCentimos).toBe(0);
    expect(t.totalCentimos).toBe(120 * 18);
    expect(liq.destajoCentimos).toBe(2160);
    expect(liq.transporteCentimos).toBe(0);
    expect(liq.totalCentimos).toBe(2160);
  });

  it("aplica la tarifa vigente en la fecha de cada jornada", () => {
    const s1 = shift({ id: "s1", fecha: "2026-09-05" });
    const s2 = shift({ id: "s2", fecha: "2026-09-20" });
    const rates = [
      rate({ amountPerUnit: 15, validFrom: "2026-01-01", validTo: "2026-09-10" }),
      rate({ amountPerUnit: 20, validFrom: "2026-09-11", validTo: null }),
    ];
    const liq = calcularLiquidacion(
      [s1, s2],
      [worker("w1", "Ana")],
      [entry({ shiftId: "s1", cantidad: 10 }), entry({ shiftId: "s2", cantidad: 10 })],
      rates,
      RANGO,
    );
    expect(liq.destajoCentimos).toBe(10 * 15 + 10 * 20);
    expect(liq.trabajadores[0].lineas[0].tarifaCentimos).toBeNull();
  });

  it("marca sinTarifa cuando no hay tarifa vigente y no suma importe", () => {
    const liq = calcularLiquidacion(
      [shift({})],
      [worker("w1", "Ana")],
      [entry({ cantidad: 50 })],
      [rate({ validFrom: "2027-01-01" })],
      RANGO,
    );
    expect(liq.hayLineasSinTarifa).toBe(true);
    expect(liq.trabajadores[0].importeCentimos).toBe(0);
    expect(liq.trabajadores[0].lineas[0].sinTarifa).toBe(true);
  });

  it("las correcciones negativas restan del importe", () => {
    const liq = calcularLiquidacion(
      [shift({})],
      [worker("w1", "Ana")],
      [entry({ cantidad: 100 }), entry({ cantidad: -10 })],
      [rate({ amountPerUnit: 18 })],
      RANGO,
    );
    expect(liq.trabajadores[0].totalUnidades).toBe(90);
    expect(liq.trabajadores[0].importeCentimos).toBe(90 * 18);
  });

  it("varios trabajadores, ordenados por nombre, con total global", () => {
    const liq = calcularLiquidacion(
      [shift({ attendeeIds: ["w1", "w2"] })],
      [worker("w1", "Zoe"), worker("w2", "Ana")],
      [entry({ workerId: "w1", cantidad: 30 }), entry({ workerId: "w2", cantidad: 40 })],
      [rate({ amountPerUnit: 10 })],
      RANGO,
    );
    expect(liq.trabajadores.map((t) => t.name)).toEqual(["Ana", "Zoe"]);
    expect(liq.totalUnidades).toBe(70);
    expect(liq.destajoCentimos).toBe(700);
  });

  it("ignora jornadas fuera del rango", () => {
    const liq = calcularLiquidacion(
      [shift({ fecha: "2026-08-15" })],
      [worker("w1", "Ana")],
      [entry({ cantidad: 100 })],
      [rate({})],
      RANGO,
    );
    expect(liq.trabajadores).toHaveLength(0);
    expect(liq.totalCentimos).toBe(0);
  });

  it("transporte = importe/dia x dias distintos trabajados", () => {
    const s1 = shift({ id: "s1", fecha: "2026-09-01", attendeeIds: ["w1"] });
    const s2 = shift({ id: "s2", fecha: "2026-09-02", attendeeIds: ["w1"] });
    // dos jornadas el mismo dia -> cuenta como un solo dia
    const s3 = shift({ id: "s3", fecha: "2026-09-02", attendeeIds: ["w1"] });
    const liq = calcularLiquidacion(
      [s1, s2, s3],
      [worker("w1", "Ana", { transporteCentimos: 500 })],
      [
        entry({ shiftId: "s1", cantidad: 10 }),
        entry({ shiftId: "s2", cantidad: 10 }),
      ],
      [rate({ amountPerUnit: 18 })],
      RANGO,
    );
    const t = liq.trabajadores[0];
    expect(t.diasTrabajados).toBe(2);
    expect(t.transporteCentimos).toBe(1000);
    expect(t.totalCentimos).toBe(t.importeCentimos + 1000);
    expect(liq.transporteCentimos).toBe(1000);
    expect(liq.totalCentimos).toBe(liq.destajoCentimos + 1000);
  });

  it("cuenta el dia de asistencia aunque el trabajador no registre nada", () => {
    const liq = calcularLiquidacion(
      [shift({ attendeeIds: ["w1", "w2"] })],
      [
        worker("w1", "Ana", { transporteCentimos: 300 }),
        worker("w2", "Beto", { transporteCentimos: 300 }),
      ],
      [entry({ workerId: "w1", cantidad: 50 })],
      [rate({ amountPerUnit: 10 })],
      RANGO,
    );
    const beto = liq.trabajadores.find((t) => t.name === "Beto")!;
    expect(beto.diasTrabajados).toBe(1);
    expect(beto.transporteCentimos).toBe(300);
    expect(beto.importeCentimos).toBe(0);
  });

  it("un registro de grupo se reparte a partes iguales, sin perder centimos", () => {
    // 100 unidades x 18 centimos = 1800 centimos entre 3 miembros -> 600 c/u exacto
    const s = shift({
      groups: [{ groupId: "g1", name: "Grupo A", memberIds: ["w1", "w2", "w3"] }],
    });
    const liq = calcularLiquidacion(
      [s],
      [worker("w1", "Ana"), worker("w2", "Beto"), worker("w3", "Ines")],
      [entry({ workerId: undefined, groupId: "g1", cantidad: 100 })],
      [rate({ amountPerUnit: 18 })],
      RANGO,
    );
    expect(liq.trabajadores).toHaveLength(3);
    for (const t of liq.trabajadores) {
      expect(t.importeCentimos).toBe(600);
      // las unidades por miembro se redondean a 2 decimales para mostrarlas
      expect(t.totalUnidades).toBeCloseTo(100 / 3, 2);
    }
    const sumaImportes = liq.trabajadores.reduce((s, t) => s + t.importeCentimos, 0);
    expect(sumaImportes).toBe(1800); // no se pierde ni un centimo
  });

  it("el resto de centimos del reparto de grupo se reparte de uno en uno", () => {
    // 10 unidades x 10 centimos = 100 centimos entre 3 -> 33,33,34
    const s = shift({
      groups: [{ groupId: "g1", name: "Grupo A", memberIds: ["w1", "w2", "w3"] }],
    });
    const liq = calcularLiquidacion(
      [s],
      [worker("w1", "Ana"), worker("w2", "Beto"), worker("w3", "Ines")],
      [entry({ workerId: undefined, groupId: "g1", cantidad: 10 })],
      [rate({ amountPerUnit: 10 })],
      RANGO,
    );
    const importes = liq.trabajadores.map((t) => t.importeCentimos).sort((a, b) => a - b);
    expect(importes).toEqual([33, 33, 34]);
    expect(importes.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("un registro de grupo sin snapshot de miembros se ignora (no revienta)", () => {
    const s = shift({ groups: [], attendeeIds: [] });
    const liq = calcularLiquidacion(
      [s],
      [worker("w1", "Ana")],
      [entry({ workerId: undefined, groupId: "g-fantasma", cantidad: 50 })],
      [rate({ amountPerUnit: 18 })],
      RANGO,
    );
    expect(liq.trabajadores).toHaveLength(0);
    expect(liq.totalCentimos).toBe(0);
  });
});
