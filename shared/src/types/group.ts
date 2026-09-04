import type { RegistroSincronizable } from "./base";

/**
 * Grupo de trabajo dentro de una cuadrilla. Es una entidad FIJA y editable
 * (como un trabajador), no algo que se recrea cada jornada: si un dia falta
 * alguien, se ajusta puntualmente la composicion de ese parte (ver
 * `Shift.groups`), sin tener que recrear el grupo.
 */
export interface Group extends RegistroSincronizable {
  name: string;
  crewId: string;
  memberIds: string[];
  activo: 0 | 1;
}
