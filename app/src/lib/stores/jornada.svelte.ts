import type {
  Entry,
  Idioma,
  Product,
  Shift,
  UnitType,
  Worker,
} from "@cuadrilla/shared";
import { sumarConteos } from "@cuadrilla/shared/domain";
import {
  guardarShift,
  jornadasAbiertas,
  obtenerShift,
} from "../db/repositories/shifts";
import {
  guardarWorker,
  trabajadoresDeCuadrilla,
} from "../db/repositories/workers";
import { delMeta, getMeta, setMeta } from "../db/meta";
import { obtenerProducto, obtenerUnidad } from "../db/repositories/products";
import {
  anularEntry,
  crearEntry,
  entriesDeJornada,
  registrarEntry,
} from "../db/repositories/entries";
import { sesion } from "./sesion.svelte";

/** Campos editables de un trabajador desde la ficha. */
export interface CambiosWorker {
  name: string;
  alias: string;
  language: Idioma;
  activo: 0 | 1;
}

/**
 * Estado de la jornada activa y logica de registro.
 *
 * Registro optimista: el contador en pantalla se actualiza de forma sincrona
 * (< 100 ms) y la escritura en IndexedDB + cola ocurre justo despues. Si la
 * escritura local fallara (raro), se revierte la interfaz.
 *
 * `entries` guarda TODOS los registros de la jornada (incluidas lapidas) para
 * poder mostrar el historial por trabajador. Los conteos se mantienen aparte,
 * incrementalmente, para no recalcular en cada pulsacion.
 */
class JornadaStore {
  shift = $state<Shift | null>(null);
  producto = $state<Product | null>(null);
  unidad = $state<UnitType | null>(null);
  workers = $state<Worker[]>([]);
  entries = $state<Entry[]>([]);
  conteos = $state<Record<string, number>>({});

  /**
   * Pila de registros hechos en ESTA sesion, para "Deshacer". Array plano a
   * proposito: cada cambio en la pila coincide siempre con un cambio en
   * `conteos`/`entries` (reactivos), asi que `puedeDeshacer` se reevalua bien.
   */
  #pila: Entry[] = [];

  async cargar(): Promise<void> {
    const shift = await this.#resolverActiva();
    if (!shift) {
      this.#reset();
      return;
    }

    this.shift = shift;
    this.producto = (await obtenerProducto(shift.productId)) ?? null;
    this.unidad = (await obtenerUnidad(shift.unitTypeId)) ?? null;

    const todos = await trabajadoresDeCuadrilla(shift.crewId);
    this.workers = todos.filter((w) => shift.attendeeIds.includes(w.id));

    this.entries = await entriesDeJornada(shift.id);
    this.conteos = sumarConteos(this.entries);
    this.#pila = [];
  }

  /** Marca una jornada abierta como la activa para la pantalla de Registro. */
  async activar(shiftId: string): Promise<void> {
    await setMeta("activeShiftId", shiftId);
    await this.cargar();
  }

  /** Cierra la jornada activa (estado `closed` + hora fin). */
  async cerrarActual(): Promise<void> {
    if (!this.shift) return;
    const base = $state.snapshot(this.shift) as Shift;
    const cerrada: Shift = {
      ...base,
      estado: "closed",
      horaFin: this.#horaActual(),
      updatedAt: Date.now(),
    };
    await guardarShift(cerrada);
    await delMeta("activeShiftId");
    await this.cargar();
  }

  /**
   * Resuelve que jornada mostrar: la marcada como activa si sigue abierta; si
   * no, la jornada abierta mas reciente (y la fija como activa).
   */
  async #resolverActiva(): Promise<Shift | undefined> {
    const activeId = await getMeta<string>("activeShiftId");
    if (activeId) {
      const s = await obtenerShift(activeId);
      if (s && s.estado === "open" && s.deleted === 0) return s;
    }
    const abiertas = await jornadasAbiertas();
    const elegida = abiertas[0];
    if (elegida) await setMeta("activeShiftId", elegida.id);
    else await delMeta("activeShiftId");
    return elegida;
  }

  #horaActual(): string {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  get hayJornada(): boolean {
    return this.shift !== null;
  }

  get puedeDeshacer(): boolean {
    return this.#pila.length > 0;
  }

  get total(): number {
    let t = 0;
    for (const v of Object.values(this.conteos)) t += v;
    return t;
  }

  conteoDe(workerId: string): number {
    return this.conteos[workerId] ?? 0;
  }

  /** Anotaciones de un trabajador en la jornada, mas recientes primero. */
  entriesDeWorker(workerId: string): Entry[] {
    return this.entries
      .filter((e) => e.workerId === workerId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async sumar(workerId: string, cantidad: number): Promise<void> {
    if (!this.shift || cantidad === 0) return;

    // 1. Pantalla primero.
    this.conteos[workerId] = (this.conteos[workerId] ?? 0) + cantidad;

    const entry = crearEntry({
      organizationId: this.shift.organizationId,
      shiftId: this.shift.id,
      workerId,
      cantidad,
      registradoPor: sesion.userId,
    });
    this.entries.push(entry);
    this.#pila.push(entry);

    // 2. IndexedDB + cola despues.
    try {
      await registrarEntry(entry);
    } catch (e) {
      this.conteos[workerId] = (this.conteos[workerId] ?? 0) - cantidad;
      this.entries = this.entries.filter((x) => x.id !== entry.id);
      this.#pila.pop();
      console.error("[jornada] no se pudo registrar", e);
      throw e;
    }
  }

  /** Deshacer el ultimo registro de esta sesion. */
  async deshacer(): Promise<void> {
    const ultima = this.#pila.pop();
    if (!ultima) return;
    await this.#anular(ultima);
  }

  /** Anular una anotacion concreta desde la ficha del trabajador. */
  async anularAnotacion(entryId: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry || entry.deleted === 1) return;
    this.#pila = this.#pila.filter((e) => e.id !== entryId);
    await this.#anular(entry);
  }

  /** Guardar cambios en la ficha del trabajador. */
  async guardarTrabajador(
    workerId: string,
    cambios: CambiosWorker,
  ): Promise<void> {
    const i = this.workers.findIndex((w) => w.id === workerId);
    if (i < 0) return;

    const actual = this.workers[i];
    const actualizado: Worker = {
      ...actual,
      name: cambios.name,
      alias: cambios.alias,
      language: cambios.language,
      activo: cambios.activo,
      updatedAt: Date.now(),
    };
    this.workers[i] = actualizado;

    try {
      await guardarWorker(actualizado);
    } catch (e) {
      this.workers[i] = actual;
      console.error("[jornada] no se pudo guardar el trabajador", e);
      throw e;
    }
  }

  async #anular(entry: Entry): Promise<void> {
    if (entry.deleted === 1) return;

    this.conteos[entry.workerId] =
      (this.conteos[entry.workerId] ?? 0) - entry.cantidad;
    this.#marcarBorrada(entry.id, 1);

    try {
      await anularEntry(entry);
    } catch (e) {
      this.conteos[entry.workerId] =
        (this.conteos[entry.workerId] ?? 0) + entry.cantidad;
      this.#marcarBorrada(entry.id, 0);
      console.error("[jornada] no se pudo anular", e);
      throw e;
    }
  }

  #marcarBorrada(id: string, deleted: 0 | 1): void {
    const i = this.entries.findIndex((e) => e.id === id);
    if (i >= 0) this.entries[i] = { ...this.entries[i], deleted };
  }

  #reset(): void {
    this.shift = null;
    this.producto = null;
    this.unidad = null;
    this.workers = [];
    this.entries = [];
    this.conteos = {};
    this.#pila = [];
  }
}

export const jornada = new JornadaStore();
