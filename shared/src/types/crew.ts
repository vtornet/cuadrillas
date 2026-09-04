import type { RegistroSincronizable } from "./base";

export interface Crew extends RegistroSincronizable {
  name: string;
  /** Usuarios con rol `foreman` que pueden registrar en esta cuadrilla. */
  foremanIds: string[];
}
