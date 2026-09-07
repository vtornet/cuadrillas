import type { Product } from "../types/product";

/**
 * Etiqueta legible de un producto: "Naranja · Navelina" si tiene variedad,
 * o "Naranja" a secas si no. Se usa en todas las pantallas que muestran el
 * producto de una jornada.
 */
export function etiquetaProducto(
  p: Pick<Product, "name" | "variedad"> | null | undefined,
): string {
  if (!p) return "";
  const v = p.variedad?.trim();
  return v ? `${p.name} · ${v}` : p.name;
}
