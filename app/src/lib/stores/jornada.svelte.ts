import type {
  AuxiliarDeJornada,
  Entry,
  GrupoDeJornada,
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

/** Un auxiliar de la jornada con su ficha y su trabajo de hoy. */
export interface AuxiliarConTrabajo {
  worker: Worker;
  tarea: string;
  /** `null` = sin horas. */
  horas: number | null;
}

/**
 * Estado de la jornada activa y logica de registro.
 *
 * Registro optimista: el contador en pantalla se actualiza de forma sincrona
 * (< 100 ms) y la escritura en IndexedDB + cola ocurre justo despues. Si la
 * escritura local fallara (raro), se revierte la interfaz.
 *
 * `entries` guarda TODOS los registros de la jornada (incluidas lapidas) para
 * poder mostrar el historial. Los conteos se mantienen aparte, incrementalmente,
 * para no recalcular en cada pulsacion.
 *
 * Los metodos de registro/anotacion son agnosticos a si el "sujeto" (`id`) es
 * un trabajador o un grupo (`shift.groups`) — `conteos`/`entries` se indexan
 * igual en los dos casos.
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

  /**
   * Cierra la jornada activa (estado `closed` + hora fin). `firma` (PNG) y
   * `firmante` (nombre de quien cierra) son opcionales.
   */
  async cerrarActual(firma?: string, firmante?: string): Promise<void> {
    if (!this.shift) return;
    const base = $state.snapshot(this.shift) as Shift;
    const cerrada: Shift = {
      ...base,
      estado: "closed",
      horaFin: this.#horaActual(),
      firma,
      firmante: firmante?.trim() || undefined,
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

  /** Grupos configurados para esta jornada (vacio = se registra por trabajador). */
  get grupos(): GrupoDeJornada[] {
    return this.shift?.groups ?? [];
  }

  get trabajaPorGrupos(): boolean {
    return this.grupos.length > 0;
  }

  /** Trabajadores presentes que recolectan (excluye auxiliares). */
  get recolectores(): Worker[] {
    return this.workers.filter((w) => w.funcion !== "auxiliar");
  }

  /** Auxiliares presentes, con su tarea/horas de hoy. */
  get auxiliares(): AuxiliarConTrabajo[] {
    const trabajo = this.shift?.auxiliares ?? [];
    return this.workers
      .filter((w) => w.funcion === "auxiliar")
      .map((w) => {
        const a = trabajo.find((x) => x.workerId === w.id);
        return {
          worker: w,
          tarea: a?.tarea ?? "",
          horas: a?.horas ?? null,
        };
      });
  }

  conteoDe(id: string): number {
    return this.conteos[id] ?? 0;
  }

  /**
   * Nombres de los "sujetos" presentes sin ninguna anotación (recolectores, o
   * grupos si se trabaja por grupos). Para el aviso al finalizar la jornada.
   * Los auxiliares no cuentan (no recolectan).
   */
  get sinAnotar(): string[] {
    if (this.trabajaPorGrupos) {
      return this.grupos
        .filter((g) => this.conteoDe(g.groupId) === 0)
        .map((g) => g.name);
    }
    return this.recolectores
      .filter((w) => this.conteoDe(w.id) === 0)
      .map((w) => w.name);
  }

  nombreTrabajador(id: string): string {
    return this.workers.find((w) => w.id === id)?.name ?? "?";
  }

  /** Anotaciones de un trabajador o grupo en la jornada, mas recientes primero. */
  entriesDe(id: string): Entry[] {
    return this.entries
      .filter((e) => e.workerId === id || e.groupId === id)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Registra una cantidad para un trabajador o (si `trabajaPorGrupos`) un grupo. */
  async sumar(id: string, cantidad: number): Promise<void> {
    if (!this.shift || cantidad === 0) return;
    const esGrupo = this.grupos.some((g) => g.groupId === id);

    // 1. Pantalla primero.
    this.conteos[id] = (this.conteos[id] ?? 0) + cantidad;

    const entry = crearEntry({
      organizationId: this.shift.organizationId,
      shiftId: this.shift.id,
      workerId: esGrupo ? undefined : id,
      groupId: esGrupo ? id : undefined,
      cantidad,
      registradoPor: sesion.userId,
    });
    this.entries.push(entry);
    this.#pila.push(entry);

    // 2. IndexedDB + cola despues.
    try {
      await registrarEntry(entry);
    } catch (e) {
      this.conteos[id] = (this.conteos[id] ?? 0) - cantidad;
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

  /** Anular una anotacion concreta desde la ficha del trabajador o del grupo. */
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

  /**
   * Guarda la tarea/horas de un auxiliar para ESTA jornada. Si ambos quedan
   * vacíos, se elimina su entrada de `Shift.auxiliares`.
   */
  async actualizarAuxiliar(
    workerId: string,
    datos: { tarea: string; horas: number | null },
  ): Promise<void> {
    if (!this.shift) return;
    const base = $state.snapshot(this.shift) as Shift;
    const anterior = base.auxiliares;

    const tarea = datos.tarea.trim();
    const horas =
      datos.horas != null && Number.isFinite(datos.horas) && datos.horas > 0
        ? datos.horas
        : undefined;
    const otros = (base.auxiliares ?? []).filter(
      (a) => a.workerId !== workerId,
    );
    const entrada: AuxiliarDeJornada = { workerId, tarea: tarea || undefined, horas };
    const auxiliares =
      entrada.tarea || entrada.horas != null ? [...otros, entrada] : otros;

    const actualizado: Shift = { ...base, auxiliares, updatedAt: Date.now() };
    this.shift = actualizado;
    try {
      await guardarShift(actualizado);
    } catch (e) {
      this.shift = { ...actualizado, auxiliares: anterior };
      console.error("[jornada] no se pudo guardar el auxiliar", e);
      throw e;
    }
  }

  /** Observaciones libres del jefe sobre el parte. Vacío = se quita el campo. */
  async actualizarObservaciones(texto: string): Promise<void> {
    if (!this.shift) return;
    const base = $state.snapshot(this.shift) as Shift;
    const observaciones = texto.trim() || undefined;
    if (observaciones === base.observaciones) return;
    const anterior = base.observaciones;
    const actualizado: Shift = { ...base, observaciones, updatedAt: Date.now() };
    this.shift = actualizado;
    try {
      await guardarShift(actualizado);
    } catch (e) {
      this.shift = { ...actualizado, observaciones: anterior };
      console.error("[jornada] no se pudieron guardar las observaciones", e);
      throw e;
    }
  }

  /**
   * Ajusta la composicion de un grupo SOLO para esta jornada (p. ej. alguien
   * falta hoy). No toca el grupo fijo de Gestion.
   */
  async actualizarGrupoDeHoy(
    groupId: string,
    memberIds: string[],
  ): Promise<void> {
    if (!this.shift?.groups) return;
    const base = $state.snapshot(this.shift) as Shift;
    const anterior = base.groups;
    const grupos = (base.groups ?? []).map((g) =>
      g.groupId === groupId ? { ...g, memberIds: [...memberIds] } : g,
    );
    const actualizado: Shift = {
      ...base,
      groups: grupos,
      updatedAt: Date.now(),
    };
    this.shift = actualizado;
    try {
      await guardarShift(actualizado);
    } catch (e) {
      this.shift = { ...actualizado, groups: anterior };
      console.error("[jornada] no se pudo actualizar el grupo", e);
      throw e;
    }
  }

  async #anular(entry: Entry): Promise<void> {
    if (entry.deleted === 1) return;
    const sujeto = entry.workerId ?? entry.groupId;
    if (!sujeto) return;

    this.conteos[sujeto] = (this.conteos[sujeto] ?? 0) - entry.cantidad;
    this.#marcarBorrada(entry.id, 1);

    try {
      await anularEntry(entry);
    } catch (e) {
      this.conteos[sujeto] = (this.conteos[sujeto] ?? 0) + entry.cantidad;
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
