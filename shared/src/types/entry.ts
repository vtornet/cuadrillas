import type { RegistroSincronizable } from "./base";

/**
 * Registro individual de unidades entregadas por un trabajador en una jornada.
 * `cantidad` puede ser negativa para corregir registros ya sincronizados.
 * "Deshacer" en el momento marca el registro como borrado (`deleted = 1`).
 */
export interface Entry extends RegistroSincronizable {
  shiftId: string;
  workerId: string;
  cantidad: number;
  /** epoch ms del momento del registro. */
  timestamp: number;
  /** userId del jefe que registró. */
  registradoPor: string;
  /** epoch ms en que el servidor confirmó el registro. Lo pone la sincronización. */
  syncedAt?: number;
}
