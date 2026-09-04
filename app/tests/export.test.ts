import { describe, expect, it } from "vitest";
import type { Liquidacion, LiquidacionTrabajador } from "@cuadrilla/shared/domain";
import { liquidacionACsv } from "../src/lib/export/csv";
import { slug } from "../src/lib/export/compartir";

function trabajador(p: Partial<LiquidacionTrabajador>): LiquidacionTrabajador {
  return {
    workerId: "w",
    name: "X",
    lineas: [],
    totalUnidades: 0,
    importeCentimos: 0,
    diasTrabajados: 0,
    transporteCentimos: 0,
    totalCentimos: 0,
    tieneLineasSinTarifa: false,
    ...p,
  };
}

const liq: Liquidacion = {
  desde: "2026-09-01",
  hasta: "2026-09-30",
  totalUnidades: 150,
  destajoCentimos: 2700,
  transporteCentimos: 1500,
  totalCentimos: 4200,
  hayLineasSinTarifa: false,
  trabajadores: [
    trabajador({
      workerId: "w1",
      name: "Ana Perez",
      totalUnidades: 100,
      importeCentimos: 1800,
      diasTrabajados: 5,
      transporteCentimos: 1500,
      totalCentimos: 3300,
    }),
    trabajador({
      workerId: "w2",
      name: "Beto Lopez",
      totalUnidades: 50,
      importeCentimos: 900,
      diasTrabajados: 3,
      transporteCentimos: 0,
      totalCentimos: 900,
    }),
  ],
};

describe("liquidacionACsv", () => {
  it("resumen por trabajador con transporte en su columna y fila TOTAL", () => {
    const lineas = liquidacionACsv(liq).slice(1).split("\r\n");

    expect(lineas[0]).toBe(
      "Trabajador;Unidades;Destajo EUR;Dias;Transporte EUR;Total EUR",
    );
    expect(lineas[1]).toBe("Ana Perez;100;18,00;5;15,00;33,00");
    expect(lineas[2]).toBe("Beto Lopez;50;9,00;3;0,00;9,00");
    expect(lineas.at(-1)).toBe("TOTAL;150;27,00;;15,00;42,00");
  });

  it("empieza por BOM UTF-8", () => {
    expect(liquidacionACsv(liq).charCodeAt(0)).toBe(0xfeff);
  });

  it("escapa valores con separador o comillas", () => {
    const conComillas: Liquidacion = {
      ...liq,
      trabajadores: [
        trabajador({ ...liq.trabajadores[0], name: 'Ana; "la rapida"' }),
      ],
    };
    expect(liquidacionACsv(conComillas)).toContain(
      '"Ana; ""la rapida"""',
    );
  });
});

describe("slug", () => {
  it("normaliza acentos y caracteres no validos", () => {
    expect(slug("Cuadrilla Ñandú 1")).toBe("cuadrilla-nandu-1");
    expect(slug("  ")).toBe("cuadrilla");
  });
});
