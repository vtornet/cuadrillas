import type { RegistroSincronizable } from "./base";

export interface Product extends RegistroSincronizable {
  /** Nombre del producto (p. ej. "Naranja"). */
  name: string;
  /** Variedad (p. ej. "Navelina"). Opcional. */
  variedad?: string;
  activo: 0 | 1;
}
