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
 * Trabajo de un auxiliar en ESTA jornada: qué tarea hizo y cuántas horas.
 * Ambos opcionales — al empezar el parte se crea vacío y el jefe lo rellena.
 */
export interface AuxiliarDeJornada {
  workerId: string;
  tarea?: string;
  /** Horas trabajadas ese día. Puede dejarse en blanco. */
  horas?: number;
}

/**
 * Jornada de trabajo de una cuadrilla. Una jornada = un producto + una unidad.
 * Si la cuadrilla trabaja dos productos el mismo día, son dos jornadas.
 */
export interface Shift extends RegistroSincronizable {
  crewId: string;
  fecha: FechaISO;
  /** Finca donde se trabaja ese día. Texto libre (opcional). */
  finca?: string;
  /** Observaciones del jefe de cuadrilla sobre el parte. Texto libre (opcional). */
  observaciones?: string;
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
  /**
   * Auxiliares presentes ese día (subconjunto de `attendeeIds` con
   * `Worker.funcion === "auxiliar"`), con su tarea/horas. Ausente = sin
   * auxiliares o aún sin rellenar.
   */
  auxiliares?: AuxiliarDeJornada[];
  /**
   * Firma del jefe de cuadrilla al finalizar el parte (PNG en data URL).
   * Opcional: se puede finalizar sin firmar. Se captura una sola vez, al
   * cerrar la jornada; editar un parte cerrado despues no la modifica.
   */
  firma?: string;
  /**
   * Nombre de quien firma/cierra el parte. Se copia del perfil (o se escribe en
   * `FirmaSheet` la primera vez) al cerrar la jornada; editar un parte cerrado
   * después no lo modifica.
   */
  firmante?: string;
}
