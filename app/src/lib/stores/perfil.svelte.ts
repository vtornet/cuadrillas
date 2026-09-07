import type { Organization } from "@cuadrilla/shared";
import { LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import { persistir } from "../db/repositories/base";
import { obtenerOrganizacion } from "../db/repositories/organizations";
import { tablaPorEntidad } from "../db/tablas";
import { sesion } from "./sesion.svelte";

export interface CamposPerfil {
  /** Nombre de la empresa o explotación. */
  empresa: string;
  /** Nombre de la persona responsable. */
  nombre: string;
  telefono: string;
  nif: string;
}

/**
 * Perfil del jefe de cuadrilla. Se guarda en el documento `Organization` (ya es
 * entidad sincronizada): `name` = empresa, `contactName`/`contactPhone`/`taxId`
 * = datos de la persona. Editar el perfil es una escritura normal que se encola
 * en `pendingOps`.
 */
class PerfilStore {
  org = $state<Organization | null>(null);

  get empresa(): string {
    return this.org?.name ?? "";
  }
  /** Nombre del responsable, para la firma de partes y las cabeceras. */
  get nombreJefe(): string {
    return this.org?.contactName?.trim() ?? "";
  }

  async cargar(): Promise<void> {
    this.org = (await obtenerOrganizacion(sesion.organizationId)) ?? null;
  }

  async guardar(campos: CamposPerfil): Promise<void> {
    const base = this.org ?? (await obtenerOrganizacion(sesion.organizationId));

    const org: Organization = {
      // Si aún no hay documento local (login sin primer sync), se crea uno
      // mínimo con el id de la sesión; el sync lo fusionará con el del servidor.
      id: sesion.organizationId,
      organizationId: sesion.organizationId,
      plan: base?.plan ?? "free",
      planLimits: base?.planLimits ?? { ...LIMITES_PLAN_GRATIS },
      deleted: 0,
      ...base,
      name: campos.empresa.trim() || base?.name || "",
      contactName: campos.nombre.trim() || undefined,
      contactPhone: campos.telefono.trim() || undefined,
      taxId: campos.nif.trim() || undefined,
      updatedAt: Date.now(),
    };

    await persistir("organization", tablaPorEntidad("organization"), org);
    await this.cargar();
  }
}

export const perfil = new PerfilStore();
