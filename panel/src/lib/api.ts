import { API_URL } from "./config";
import { sesion } from "./sesion.svelte";

type Metodo = "GET" | "POST" | "PUT" | "DELETE";

interface Opciones {
  metodo?: Metodo;
  params?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * Llamada a `/admin/*` con el token de sesión. Un 401 cierra la sesión (token
 * caducado). Devuelve el JSON ya parseado.
 */
export async function api<T>(path: string, opts: Opciones = {}): Promise<T> {
  const url = new URL(`${API_URL}/admin${path}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = sesion.token
    ? { authorization: `Bearer ${sesion.token}` }
    : {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  const r = await fetch(url, {
    method: opts.metodo ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
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

/** GET simple con query params. */
export function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return api<T>(path, { params });
}
