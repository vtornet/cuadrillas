import { API_URL } from "./config";
import { sesion } from "./sesion.svelte";

/**
 * Llamada GET a `/admin/*` con el token de sesión. Un 401 cierra la sesión
 * (token caducado). Devuelve el JSON ya parseado.
 */
export async function api<T>(
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<T> {
  const url = new URL(`${API_URL}/admin${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const r = await fetch(url, {
    headers: sesion.token ? { authorization: `Bearer ${sesion.token}` } : {},
  });
  if (r.status === 401) {
    sesion.salir();
    throw new Error("Sesión caducada, vuelve a entrar");
  }
  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(cuerpo.error ?? `Error ${r.status}`);
  }
  return r.json() as Promise<T>;
}
