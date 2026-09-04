import type { FechaISO, HoraISO, RegistroSincronizable } from "./base";

export type EstadoJornada = "open" | "closed";

/**
 * Composicion de un grupo tal como quedo configurada para ESTA jornada
 * concreta (copia de `Group.memberIds` en el momento de comenzar el parte,
 * ajustable durante el dia sin alterar el grupo fijo). Es la que se usa para
 * repartir las unidades del grupo entre sus miembros en la liquidacion.
 */
export interface GrupoDeJornada {
  groupId: string;
  name: string;
  memberIds: string[];
}

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
  /** Trabajadores presentes en la jornada (asistencia individual). */
  attendeeIds: string[];
  /**
   * Si se trabaja por grupos ese dia: grupos activos en este parte, con su
   * composicion de ese dia. Ausente o vacio = registro por trabajador.
   */
  groups?: GrupoDeJornada[];
}
