import type { Product, UnitType } from "@cuadrilla/shared";
import { db } from "../dexie";

export function obtenerProducto(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export function obtenerUnidad(id: string): Promise<UnitType | undefined> {
  return db.unitTypes.get(id);
}

/** Todos los productos (activos e inactivos, no borrados) de la organizacion. */
export async function todosLosProductos(
  organizationId: string,
): Promise<Product[]> {
  const todos = await db.products
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todos
    .filter((p) => p.deleted === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function productosActivos(
  organizationId: string,
): Promise<Product[]> {
  const todos = await db.products
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todos
    .filter((p) => p.deleted === 0 && p.activo === 1)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Todas las unidades de la organizacion (globales y por producto). */
export async function todasLasUnidades(
  organizationId: string,
): Promise<UnitType[]> {
  const todas = await db.unitTypes
    .where("organizationId")
    .equals(organizationId)
    .toArray();
  return todas
    .filter((u) => u.deleted === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
