import type { RegistroSincronizable } from "../types/base";

/**
 * Politica "ultima escritura gana" (LWW) por registro, comparando `updatedAt`
 * (epoch ms que el cliente reescribe en cada escritura local).
 *
 * Empate (`>=`): gana el entrante. En el servidor eso significa "el ultimo en
 * llegar gana"; en el cliente, "el servidor gana" al aplicar cambios recibidos.
 * Convencion deliberada y consistente en ambos lados.
 */
export function entranteGana(
  entrante: Pick<RegistroSincronizable, "updatedAt">,
  local: Pick<RegistroSincronizable, "updatedAt"> | undefined | null,
): boolean {
  if (!local) return true;
  return entrante.updatedAt >= local.updatedAt;
}

/**
 * Devuelve la version que debe prevalecer entre dos del mismo registro.
 * No muta. Una lapida (`deleted`) es un cambio mas: gana o pierde por `updatedAt`.
 */
export function fusionar<T extends RegistroSincronizable>(
  entrante: T,
  local: T | undefined | null,
): T {
  return entranteGana(entrante, local) ? entrante : (local as T);
}
