import { db } from "./dexie";

/** Acceso tipado a la tabla `meta` (pares clave/valor locales). */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function delMeta(key: string): Promise<void> {
  await db.meta.delete(key);
}
