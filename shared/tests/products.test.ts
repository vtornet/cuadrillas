import { describe, expect, it } from "vitest";
import { etiquetaProducto } from "../src/domain/products";

describe("etiquetaProducto", () => {
  it("une producto y variedad con ' · '", () => {
    expect(etiquetaProducto({ name: "Naranja", variedad: "Navelina" })).toBe(
      "Naranja · Navelina",
    );
  });

  it("sin variedad devuelve solo el nombre", () => {
    expect(etiquetaProducto({ name: "Naranja" })).toBe("Naranja");
    expect(etiquetaProducto({ name: "Naranja", variedad: "  " })).toBe("Naranja");
    expect(etiquetaProducto({ name: "Naranja", variedad: undefined })).toBe(
      "Naranja",
    );
  });

  it("null/undefined devuelve cadena vacía", () => {
    expect(etiquetaProducto(null)).toBe("");
    expect(etiquetaProducto(undefined)).toBe("");
  });
});
