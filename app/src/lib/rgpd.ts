import type { Worker } from "@cuadrilla/shared";
import {
  informeTrabajador,
  type InformeTrabajador,
} from "@cuadrilla/shared/domain";
import { sesion } from "./stores/sesion.svelte";
import { gestion } from "./stores/gestion.svelte";
import { shiftsDeOrg } from "./db/repositories/shifts";
import { entriesDeShifts } from "./db/repositories/entries";

/**
 * RGPD: reúne desde IndexedDB todos los partes y anotaciones y construye el
 * informe de datos personales del trabajador (lógica pura en
 * `shared/domain/rgpd`). Los nombres de cuadrilla/producto/unidad salen del
 * store `gestion`, que la pantalla de Datos ya tiene cargado.
 */
export async function generarInformeTrabajador(
  worker: Worker,
): Promise<InformeTrabajador> {
  const shifts = await shiftsDeOrg(sesion.organizationId);
  const entries = await entriesDeShifts(shifts.map((s) => s.id));
  return informeTrabajador(worker, shifts, entries, {
    crew: (id) => gestion.nombreCrew(id),
    producto: (id) => gestion.nombreProducto(id),
    unidad: (id) => gestion.nombreUnidad(id),
  });
}
