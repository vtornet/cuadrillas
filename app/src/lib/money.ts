/**
 * Dinero en centimos enteros. El formateo a EUR es solo de presentacion.
 * Moneda fija (EUR) en el MVP.
 */

export function centimosAEuros(centimos: number): string {
  return (centimos / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

/** Convierte texto ("0,18" o "0.18") a centimos. `null` si no es valido. */
export function eurosACentimos(texto: string): number | null {
  const n = Number.parseFloat(texto.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Representacion editable en euros de un importe en centimos ("0,18"). */
export function centimosATexto(centimos: number): string {
  return (centimos / 100).toString().replace(".", ",");
}

/** Decimal con 2 posiciones y coma, para exportaciones ("21,60"). */
export function centimosADecimal(centimos: number): string {
  return (centimos / 100).toFixed(2).replace(".", ",");
}

/** Numero en euros con 2 decimales (para celdas numericas de XLSX). */
export function centimosANumero(centimos: number): number {
  return Math.round(centimos) / 100;
}
