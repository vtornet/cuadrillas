export type Rol = "owner" | "foreman" | "worker";

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
