import { describe, expect, it } from "vitest";
import { slug } from "../src/lib/export/compartir";

describe("slug", () => {
  it("normaliza acentos y caracteres no validos", () => {
    expect(slug("Cuadrilla Ñandú 1")).toBe("cuadrilla-nandu-1");
    expect(slug("  ")).toBe("cuadrilla");
  });
});
