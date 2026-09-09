/** Dinero en céntimos enteros; el formateo a EUR es solo presentación. */

export function eur(centimos: number): string {
  return (centimos / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

/** Texto editable en euros ("0,18") desde céntimos. */
export function centimosATexto(centimos: number): string {
  return (centimos / 100).toString().replace(".", ",");
}

/** "0,18" o "0.18" → céntimos. `null` si no es válido. */
export function eurosACentimos(texto: string): number | null {
  const n = Number.parseFloat(texto.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
