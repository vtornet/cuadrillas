/**
 * - `owner`: dueño de la organización (todo, incluida la facturación).
 * - `gestor`: panel de empresa — consulta de partes/asistencia, tarifas,
 *   liquidaciones y altas laborales. No crea partes.
 * - `foreman`: jefe de cuadrilla — la PWA de campo.
 * - `worker`: trabajador que consulta su propio conteo (fuera de MVP).
 */
export type Rol = "owner" | "gestor" | "foreman" | "worker";

export interface User {
  id: string;
  email: string;
  role: Rol;
  organizationId: string;
  /** Si el usuario es un trabajador que consulta su propio conteo. */
  workerId?: string;
  updatedAt: number;
  deleted: 0 | 1;
}
