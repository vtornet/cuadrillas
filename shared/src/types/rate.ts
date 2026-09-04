import type { FechaISO, RegistroSincronizable } from "./base";

export interface Rate extends RegistroSincronizable {
  productId: string;
  unitTypeId: string;
  /** Importe por unidad en céntimos (entero), para evitar errores de coma flotante. */
  amountPerUnit: number;
  /** Vigencia desde (inclusive). */
  validFrom: FechaISO;
  /** Vigencia hasta (inclusive). `null` = tarifa abierta. */
  validTo: FechaISO | null;
}
