import { describe, expect, it } from "vitest";
import { sumarConteos, totalJornada } from "../src/domain/entries";

describe("sumarConteos", () => {
  it("suma por trabajador e ignora registros borrados", () => {
    const conteos = sumarConteos([
      { workerId: "a", cantidad: 5, deleted: 0 },
      { workerId: "a", cantidad: 3, deleted: 0 },
      { workerId: "b", cantidad: 2, deleted: 0 },
      { workerId: "b", cantidad: 9, deleted: 1 },
    ]);
    expect(conteos).toEqual({ a: 8, b: 2 });
  });

  it("admite correcciones negativas", () => {
    const conteos = sumarConteos([
      { workerId: "a", cantidad: 10, deleted: 0 },
      { workerId: "a", cantidad: -4, deleted: 0 },
    ]);
    expect(conteos.a).toBe(6);
    expect(totalJornada(conteos)).toBe(6);
  });

  it("devuelve objeto vacío sin registros", () => {
    expect(sumarConteos([])).toEqual({});
    expect(totalJornada({})).toBe(0);
  });

  it("suma por grupo cuando el registro es de un grupo", () => {
    const conteos = sumarConteos([
      { groupId: "g1", cantidad: 20, deleted: 0 },
      { groupId: "g1", cantidad: 5, deleted: 0 },
      { workerId: "a", cantidad: 3, deleted: 0 },
    ]);
    expect(conteos).toEqual({ g1: 25, a: 3 });
  });

  it("ignora un registro sin trabajador ni grupo", () => {
    expect(sumarConteos([{ cantidad: 5, deleted: 0 }])).toEqual({});
  });
});
