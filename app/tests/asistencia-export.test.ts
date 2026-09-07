import { describe, expect, it } from "vitest";
import { asistenciaMensual } from "@cuadrilla/shared/domain";
import type { Shift, Worker } from "@cuadrilla/shared";
import { asistenciaACsv } from "../src/lib/export/asistencia";

function worker(id: string, name: string): Worker {
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
  };
}

function shift(fecha: string, attendeeIds: string[]): Shift {
  return {
    id: crypto.randomUUID(),
    organizationId: "o",
    crewId: "c1",
    fecha,
    horaInicio: "08:00",
    horaFin: "14:00",
    productId: "p1",
    unitTypeId: "u1",
    estado: "closed",
    attendeeIds,
    updatedAt: 1,
    deleted: 0,
  };
}

describe("asistenciaACsv", () => {
  it("cabecera de días, una X por asistencia y fila de totales", () => {
    const tabla = asistenciaMensual(
      [shift("2026-09-01", ["w1", "w2"]), shift("2026-09-02", ["w1"])],
      [worker("w1", "Ana"), worker("w2", "Beto")],
      2026,
      9,
    );
    const lineas = asistenciaACsv(tabla).slice(1).split("\r\n");

    expect(lineas[0].startsWith("Trabajador;1;2;3;")).toBe(true);
    expect(lineas[0].endsWith(";30;Total")).toBe(true);
    expect(lineas[1]).toBe(`Ana;X;X;${";".repeat(28)}2`);
    expect(lineas[2]).toBe(`Beto;X;${";".repeat(29)}1`);
    expect(lineas[3]).toBe(`Total;2;1;${"0;".repeat(28)}3`);
  });

  it("empieza por BOM UTF-8", () => {
    const tabla = asistenciaMensual([], [], 2026, 9);
    expect(asistenciaACsv(tabla).charCodeAt(0)).toBe(0xfeff);
  });
});
