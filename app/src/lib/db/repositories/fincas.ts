import type { Finca } from "@cuadrilla/shared";
import { db } from "../dexie";
import { persistir } from "./base";

/** Todas las fincas (activas e inactivas, no borradas) de la organizacion. */
export async function todasLasFincas(organizationId: string): Promise<Finca[]> {
  const todas = await db.fincas
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todas
    .filter((f) => f.deleted === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Fincas activas, para el desplegable al comenzar un parte. */
export async function fincasActivas(organizationId: string): Promise<Finca[]> {
  return (await todasLasFincas(organizationId)).filter((f) => f.activo === 1);
}

/**
 * Alta de una finca escrita a mano en el desplegable de "Comenzar jornada".
 * Si ya existe una activa con ese nombre (sin distinguir mayusculas/espacios)
 * se devuelve esa; si no, se crea y se encola como un alta normal.
 */
export async function fincaPorNombreOAlta(
  organizationId: string,
  nombre: string,
): Promise<Finca> {
  const limpio = nombre.trim();
  const norm = limpio.toLocaleLowerCase("es");
  const existentes = await todasLasFincas(organizationId);
  const ya = existentes.find((f) => f.name.toLocaleLowerCase("es") === norm);
  if (ya) return ya;

  const finca: Finca = {
    id: crypto.randomUUID(),
    organizationId,
    name: limpio,
    activo: 1,
    updatedAt: Date.now(),
    deleted: 0,
  };
  await persistir("finca", db.fincas, finca);
  return finca;
}
