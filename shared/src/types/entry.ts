import type { RegistroSincronizable } from "./base";

/**
 * Registro individual de unidades entregadas por un trabajador (o un grupo)
 * en una jornada. `cantidad` puede ser negativa para corregir registros ya
 * sincronizados. "Deshacer" en el momento marca el registro como borrado
 * (`deleted = 1`).
 *
 * Exactamente uno de `workerId` / `groupId` esta presente: si la jornada se
 * trabaja por grupos, las anotaciones son del grupo (ver `Shift.groups` para
 * repartir despues entre sus miembros); si no, son de un trabajador.
 */
export interface Entry extends RegistroSincronizable {
  shiftId: string;
  workerId?: string;
  groupId?: string;
  cantidad: number;
  /** epoch ms del momento del registro. */
  timestamp: number;
  /** userId del jefe que registró. */
  registradoPor: string;
  /** epoch ms en que el servidor confirmó el registro. Lo pone la sincronización. */
  syncedAt?: number;
}
