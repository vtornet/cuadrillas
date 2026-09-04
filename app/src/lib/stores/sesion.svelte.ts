import { auth } from "../auth/auth.svelte";

/**
 * Identidad del usuario para el resto de la app. Deriva de `auth`: en modo demo
 * son valores fijos; autenticado, los de la sesion real.
 */
export const sesion = {
  get userId(): string {
    return auth.userId;
  },
  get organizationId(): string {
    return auth.organizationId;
  },
  get rol(): string {
    return auth.role;
  },
};
