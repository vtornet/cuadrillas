import { describe, expect, it } from "vitest";
import XLSX from "xlsx-js-style";
import { tablaACsv, tablaAXlsx, tablaAPdf, type Tabla } from "../src/lib/export/tabla";

const t: Tabla = {
  titulo: "Liquidación",
  meta: ["Periodo: 2026-03-01 — 2026-03-31"],
  cabeceras: ["Trabajador", "Unidades", "Total (€)"],
  filas: [
    ["Ana", 100, 18],
    ["Beto", 50, 9],
  ],
  total: ["TOTAL", 150, 27],
};

describe("export/tabla", () => {
  it("CSV: BOM UTF-8 + título, meta, cabecera, filas y total con ;", async () => {
    const blob = tablaACsv(t);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const texto = await blob.text(); // .text() se come el BOM
    const lineas = texto.split("\r\n");
    expect(lineas[0]).toBe("Liquidación");
    expect(lineas[1]).toBe("Periodo: 2026-03-01 — 2026-03-31");
    expect(lineas[3]).toBe("Trabajador;Unidades;Total (€)");
    expect(lineas[4]).toBe("Ana;100;18");
    expect(lineas.at(-1)).toBe("TOTAL;150;27");
  });

  it("Excel: hoja legible con cabecera, filas y total", async () => {
    const buf = await (await tablaAXlsx(t)).arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const filas = XLSX.utils.sheet_to_json<string[]>(
      wb.Sheets[wb.SheetNames[0]],
      { header: 1 },
    );
    expect(filas[0][0]).toBe("Liquidación");
    const cab = filas.find((f) => f[0] === "Trabajador");
    expect(cab).toEqual(["Trabajador", "Unidades", "Total (€)"]);
    const total = filas.find((f) => f[0] === "TOTAL");
    expect(total?.[2]).toBe(27);
  });

  it("PDF: devuelve un blob no vacío con cabecera %PDF", async () => {
    const blob = await tablaAPdf(t);
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    expect(String.fromCharCode(...head)).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(500);
  });
});
