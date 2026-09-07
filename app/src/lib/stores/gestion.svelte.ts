import type {
  Crew,
  Group,
  Product,
  Rate,
  RegistroSincronizable,
  UnitType,
  Worker,
} from "@cuadrilla/shared";
import { persistir } from "../db/repositories/base";
import { tablaPorEntidad } from "../db/tablas";
import { crewsDeOrg } from "../db/repositories/crews";
import { todosLosWorkers } from "../db/repositories/workers";
import { todosLosGrupos } from "../db/repositories/groups";
import {
  todasLasUnidades,
  todosLosProductos,
} from "../db/repositories/products";
import { todasLasTarifas } from "../db/repositories/rates";
import { sesion } from "./sesion.svelte";
import { jornada } from "./jornada.svelte";

export type TipoGestion =
  | "worker"
  | "product"
  | "unitType"
  | "rate"
  | "crew"
  | "group";

/**
 * Estado y CRUD de la pantalla de Gestion. Toda escritura pasa por la cola
 * `pendingOps` y refresca las listas y la jornada activa.
 */
class GestionStore {
  crews = $state<Crew[]>([]);
  workers = $state<Worker[]>([]);
  groups = $state<Group[]>([]);
  products = $state<Product[]>([]);
  units = $state<UnitType[]>([]);
  rates = $state<Rate[]>([]);

  async cargar(): Promise<void> {
    const org = sesion.organizationId;
    this.crews = await crewsDeOrg(org);
    this.workers = await todosLosWorkers(org);
    this.groups = await todosLosGrupos(org);
    this.products = await todosLosProductos(org);
    this.units = await todasLasUnidades(org);
    this.rates = await todasLasTarifas(org);
  }

  async guardar(
    tipo: TipoGestion,
    record: RegistroSincronizable,
  ): Promise<void> {
    await persistir(tipo, tablaPorEntidad(tipo), {
      ...record,
      updatedAt: Date.now(),
    });
    await this.#trasCambio();
  }

  /**
   * Alta en bloque de trabajadores (importacion desde Excel/CSV). Cada uno
   * pasa por `persistir`, igual que un alta manual: se encola en `pendingOps`.
   */
  async importarWorkers(workers: Worker[]): Promise<void> {
    for (const w of workers) {
      await persistir("worker", tablaPorEntidad("worker"), {
        ...w,
        updatedAt: Date.now(),
      });
    }
    await this.#trasCambio();
  }

  async eliminar(
    tipo: TipoGestion,
    record: RegistroSincronizable,
  ): Promise<void> {
    await persistir(tipo, tablaPorEntidad(tipo), {
      ...record,
      deleted: 1,
      updatedAt: Date.now(),
    });
    await this.#trasCambio();
  }

  nombreProducto(id: string | null): string {
    if (!id) return "";
    return this.products.find((p) => p.id === id)?.name ?? "?";
  }
  nombreUnidad(id: string): string {
    return this.units.find((u) => u.id === id)?.name ?? "?";
  }
  nombreCrew(id: string): string {
    return this.crews.find((c) => c.id === id)?.name ?? "?";
  }
  nombreWorker(id: string): string {
    return this.workers.find((w) => w.id === id)?.name ?? "?";
  }

  /** Trabajadores (no borrados) de una cuadrilla, para la ficha de Gestion. */
  trabajadoresDe(crewId: string): Worker[] {
    return this.workers.filter((w) => w.crewId === crewId);
  }

  /** Grupos (no borrados) de una cuadrilla, para la ficha de Gestion. */
  gruposDe(crewId: string): Group[] {
    return this.groups.filter((g) => g.crewId === crewId);
  }

  async #trasCambio(): Promise<void> {
    await this.cargar();
    await jornada.cargar();
  }
}

export const gestion = new GestionStore();
