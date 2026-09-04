import type { Organization } from "@cuadrilla/shared";
import { db } from "../dexie";

export function obtenerOrganizacion(
  id: string,
): Promise<Organization | undefined> {
  return db.organizations.get(id);
}
