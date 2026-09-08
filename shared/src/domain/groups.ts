import type { Group } from "../types/group";

/**
 * Un trabajador solo puede pertenecer a un grupo a la vez. Devuelve un mapa
 * `workerId -> nombre del grupo` con los grupos activos (no borrados), excluido
 * `exceptoId` (el grupo que se está editando). Puro.
 */
export function gruposPorTrabajador(
  groups: Group[],
  exceptoId?: string,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groups) {
    if (g.deleted !== 0 || g.activo !== 1 || g.id === exceptoId) continue;
    for (const wid of g.memberIds) {
      if (!m.has(wid)) m.set(wid, g.name);
    }
  }
  return m;
}
