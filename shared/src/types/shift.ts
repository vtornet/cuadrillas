import type { FechaISO, HoraISO, RegistroSincronizable } from "./base";

export type EstadoJornada = "open" | "closed";

/**
 * Jornada de trabajo de una cuadrilla. Una jornada = un producto + una unidad.
 * Si la cuadrilla trabaja dos productos el mismo día, son dos jornadas.
 */
export interface Shift extends RegistroSincronizable {
  crewId: string;
  fecha: FechaISO;
  horaInicio: HoraISO | null;
  horaFin: HoraISO | null;
  productId: string;
  unitTypeId: string;
  estado: EstadoJornada;
  /** Trabajadores presentes en la jornada (asistencia). */
  attendeeIds: string[];
}
