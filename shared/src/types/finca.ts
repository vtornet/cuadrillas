import type { RegistroSincronizable } from "./base";

/**
 * Finca / explotación donde trabaja una cuadrilla un día concreto. Entidad
 * FIJA y editable (como un producto): se gestiona en Datos y alimenta el
 * desplegable al comenzar un parte. El `Shift` guarda el nombre como texto
 * (snapshot), así el histórico es estable aunque la finca se renombre o borre.
 */
export interface Finca extends RegistroSincronizable {
  name: string;
  activo: 0 | 1;
}
