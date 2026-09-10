import type {
  Crew,
  Finca,
  Group,
  Organization,
  Product,
  RegistroSincronizable,
  UnitType,
  Worker,
} from "@cuadrilla/shared";
import { LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import {
  anonimizarWorker as anonimizarWorkerPuro,
  etiquetaProducto,
} from "@cuadrilla/shared/domain";
import { persistir } from "../db/repositories/base";
import { tablaPorEntidad } from "../db/tablas";
import { crewsDelForeman } from "../db/repositories/crews";
import { todosLosWorkers } from "../db/repositories/workers";
import { todosLosGrupos } from "../db/repositories/groups";
import { todasLasFincas } from "../db/repositories/fincas";
import { obtenerOrganizacion } from "../db/repositories/organizations";
import {
  todasLasUnidades,
  todosLosProductos,
} from "../db/repositories/products";
import { sesion } from "./sesion.svelte";
import { jornada } from "./jornada.svelte";

// Nota: las tarifas (`Rate`) ya no se editan desde la app del jefe de cuadrilla
// (no maneja datos económicos). La entidad sigue existiendo y sincronizándose
// para un futuro panel de empresa/gestor que calcule liquidaciones.
export type TipoGestion =
  | "worker"
  | "product"
  | "unitType"
  | "crew"
  | "group"
  | "finca";

/**
 * Estado y CRUD de la pantalla de Gestion. Toda escritura pasa por la cola
 * `pendingOps` y refresca las listas y la jornada activa.
 */
class GestionStore {
  crews = $state<Crew[]>([]);
  workers = $state<Worker[]>([]);
  groups = $state<Group[]>([]);
  fincas = $state<Finca[]>([]);
  products = $state<Product[]>([]);
  units = $state<UnitType[]>([]);
  org = $state<Organization | null>(null);

  /**
   * Carga los datos de la pantalla "Datos". **Cuadrillas, trabajadores y
   * grupos van filtrados a las cuadrillas del jefe** (`Crew.foremanIds`): en
   * una empresa con varios jefes cada uno gestiona lo suyo. Productos, unidades
   * y fincas son catálogo de la organización (compartidos).
   */
  async cargar(): Promise<void> {
    const org = sesion.organizationId;
    this.crews = await crewsDelForeman(sesion.userId);
    const mias = new Set(this.crews.map((c) => c.id));

    const [todosWorkers, todosGrupos] = await Promise.all([
      todosLosWorkers(org),
      todosLosGrupos(org),
    ]);
    this.workers = todosWorkers.filter((w) => mias.has(w.crewId));
    this.groups = todosGrupos.filter((g) => mias.has(g.crewId));

    this.fincas = await todasLasFincas(org);
    this.products = await todosLosProductos(org);
    this.units = await todasLasUnidades(org);
    this.org = (await obtenerOrganizacion(org)) ?? null;
  }

  /** Nº máximo de cuadrillas del plan actual. */
  get limiteCuadrillas(): number {
    return this.org?.planLimits?.crews ?? LIMITES_PLAN_GRATIS.crews;
  }

  /** Puede crear otra cuadrilla sin superar el límite del plan. */
  get puedeCrearCuadrilla(): boolean {
    return this.crews.length < this.limiteCuadrillas;
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

  /**
   * RGPD (derecho de supresión): borra los datos personales del trabajador
   * conservando el registro (para que el histórico siga resolviendo el nombre
   * como genérico). No es una lápida. `nombreGenerico` llega ya traducido.
   */
  async anonimizarWorker(worker: Worker, nombreGenerico: string): Promise<void> {
    await persistir(
      "worker",
      tablaPorEntidad("worker"),
      anonimizarWorkerPuro(worker, nombreGenerico),
    );
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
    const p = this.products.find((p) => p.id === id);
    return p ? etiquetaProducto(p) : "?";
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
