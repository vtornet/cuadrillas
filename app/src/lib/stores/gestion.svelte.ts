import type {
  Crew,
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
import {
  todasLasUnidades,
  todosLosProductos,
} from "../db/repositories/products";
import { todasLasTarifas } from "../db/repositories/rates";
import { sesion } from "./sesion.svelte";
import { jornada } from "./jornada.svelte";

export type TipoGestion = "worker" | "product" | "unitType" | "rate";

/**
 * Estado y CRUD de la pantalla de Gestion. Toda escritura pasa por la cola
 * `pendingOps` y refresca las listas y la jornada activa.
 */
class GestionStore {
  crews = $state<Crew[]>([]);
  workers = $state<Worker[]>([]);
  products = $state<Product[]>([]);
  units = $state<UnitType[]>([]);
  rates = $state<Rate[]>([]);

  async cargar(): Promise<void> {
    const org = sesion.organizationId;
    this.crews = await crewsDeOrg(org);
    this.workers = await todosLosWorkers(org);
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

  async #trasCambio(): Promise<void> {
    await this.cargar();
    await jornada.cargar();
  }
}

export const gestion = new GestionStore();
