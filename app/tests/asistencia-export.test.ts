import { describe, expect, it } from "vitest";
import XLSX from "xlsx-js-style";
import { asistenciaMensual } from "@cuadrilla/shared/domain";
import type { Shift, Worker } from "@cuadrilla/shared";
import { asistenciaACsv, asistenciaAXlsx } from "../src/lib/export/asistencia";

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

function shift(fecha: string, attendeeIds: string[], finca?: string): Shift {
  return {
    id: crypto.randomUUID(),
    organizationId: "o",
    crewId: "c1",
    fecha,
    finca,
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

const ETIQUETAS = {
  trabajador: "Trabajador",
  total: "Total",
  totalRecolectores: "Total recolectores",
  totalAuxiliares: "Total auxiliares",
  fincas: "Fincas",
};

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

describe("asistenciaAXlsx", () => {
  it("genera un .xlsx con título, cabecera de días y fila de totales", async () => {
    const tabla = asistenciaMensual(
      [shift("2026-09-01", ["w1", "w2"]), shift("2026-09-02", ["w1"])],
      [worker("w1", "Ana"), worker("w2", "Beto")],
      2026,
      9,
    );
    const blob = await asistenciaAXlsx(tabla, {
      titulo: "Asistencia · septiembre 2026",
      cuadrillas: "Cuadrilla 1",
      etiquetas: ETIQUETAS,
    });
    const buf = await blob.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

    expect(filas[0][0]).toBe("Asistencia · septiembre 2026");
    const cab = filas.find((f) => f[0] === "Trabajador");
    expect(cab?.[1]).toBe(1);
    expect(cab?.[cab.length - 1]).toBe("Total");
    const ana = filas.find((f) => f[0] === "Ana");
    expect(ana?.[1]).toBe("X");
    expect(ana?.[ana.length - 1]).toBe(2);
    const total = filas.filter((f) => f[0] === "Total").pop();
    expect(total?.[total.length - 1]).toBe(3);
  });

  it("añade filas de total por rol y línea de fincas", async () => {
    const tabla = asistenciaMensual(
      [
        shift("2026-09-01", ["w1", "w2"], "La Loma"),
        shift("2026-09-02", ["w1"], "El Cerro"),
      ],
      [
        worker("w1", "Ana"),
        { ...worker("w2", "Beto"), funcion: "auxiliar" as const },
      ],
      2026,
      9,
    );
    const blob = await asistenciaAXlsx(tabla, {
      titulo: "Asistencia",
      cuadrillas: "Cuadrilla 1",
      etiquetas: ETIQUETAS,
    });
    const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
    const filas = XLSX.utils.sheet_to_json<string[]>(
      wb.Sheets[wb.SheetNames[0]],
      { header: 1 },
    );
    const txt = filas.map((f) => f.join("|")).join("\n");
    expect(txt).toContain("Fincas: El Cerro, La Loma");
    expect(filas.some((f) => f[0] === "Total recolectores")).toBe(true);
    expect(filas.some((f) => f[0] === "Total auxiliares")).toBe(true);
  });
});
