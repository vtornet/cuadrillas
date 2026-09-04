/**
 * Campos de control comunes a toda entidad que se sincroniza con el servidor.
 *
 * - `id`: UUID v4 generado en el cliente. Es la misma clave en IndexedDB y en MongoDB.
 * - `updatedAt`: epoch ms. Se reescribe en CADA escritura local. Es la base de la
 *   política "última escritura gana" (LWW) al resolver conflictos.
 * - `deleted`: lápida (tombstone). 0/1 en vez de boolean porque IndexedDB/Dexie no
 *   indexa booleanos de forma fiable. Se propaga como un cambio más.
 */
export interface RegistroSincronizable {
  id: string;
  organizationId: string;
  updatedAt: number;
  deleted: 0 | 1;
}

/** Fecha en formato `YYYY-MM-DD` (día natural, sin zona horaria). */
export type FechaISO = string;

/** Hora en formato `HH:mm`. */
export type HoraISO = string;
