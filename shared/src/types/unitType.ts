import type { RegistroSincronizable } from "./base";

export interface UnitType extends RegistroSincronizable {
  name: string;
  /** Abreviatura para mostrar en tablas y liquidaciones (p. ej. "cj", "kg"). */
  abbr: string;
  /** `null` = unidad global de la organización, no ligada a un producto. */
  productId: string | null;
}
