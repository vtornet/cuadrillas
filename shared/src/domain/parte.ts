import type { Entry } from "../types/entry";
import type { Shift } from "../types/shift";
import type { Worker } from "../types/worker";
import { sumarConteos, totalJornada } from "./entries";

/**
 * Informes de un parte para exportar (PDF / Excel). Puros, sin IO. Dos formas:
 * `InformeAsistencia` (solo la lista de trabajadores por rol) e `InformeParte`
 * (parte completo: unidades por recolector/grupo + tarea/horas de auxiliares).
 */

export interface CabeceraInforme {
  cuadrilla: string;
  finca?: string;
  /** Fecha ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Etiqueta del producto ("Naranja · Navelina"). */
  producto: string;
  /** Nombre de la unidad ("Caja"). */
  unidad: string;
  firmante?: string;
  /** Firma del jefe en PNG (data URL), si el parte está firmado. */
  firmaPng?: string;
}

export interface GrupoAsistencia {
  nombre: string;
  miembros: string[];
}

export interface InformeAsistencia {
  cabecera: CabeceraInforme;
  recolectores: string[];
  auxiliares: string[];
  /** Si el parte se trabaja por grupos: composición de hoy. */
  grupos: GrupoAsistencia[];
}

export interface FilaRecolector {
  nombre: string;
  unidades: number;
}
export interface FilaGrupo {
  nombre: string;
  unidades: number;
  miembros: string[];
}
export interface FilaAuxiliar {
  nombre: string;
  tarea: string;
  horas: number | null;
}

export interface InformeParte {
  cabecera: CabeceraInforme;
  /** Vacío si el parte se trabaja por grupos. */
  recolectores: FilaRecolector[];
  grupos: FilaGrupo[];
  auxiliares: FilaAuxiliar[];
  totalUnidades: number;
}

function porNombre(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, "es");
}

type ShiftInforme = Pick<Shift, "attendeeIds" | "groups" | "auxiliares">;

/** Solo la lista de trabajadores presentes, separados por rol. */
export function informeAsistencia(
  cabecera: CabeceraInforme,
  shift: ShiftInforme,
  workers: Worker[],
): InformeAsistencia {
  const nombre = new Map(workers.map((w) => [w.id, w.name]));
  const presentes = workers.filter((w) => shift.attendeeIds.includes(w.id));
  return {
    cabecera,
    recolectores: presentes
      .filter((w) => w.funcion !== "auxiliar")
      .map((w) => w.name)
      .sort((a, b) => a.localeCompare(b, "es")),
    auxiliares: presentes
      .filter((w) => w.funcion === "auxiliar")
      .map((w) => w.name)
      .sort((a, b) => a.localeCompare(b, "es")),
    grupos: (shift.groups ?? []).map((g) => ({
      nombre: g.name,
      miembros: g.memberIds
        .map((id) => nombre.get(id) ?? "?")
        .sort((a, b) => a.localeCompare(b, "es")),
    })),
  };
}

/** Parte completo: unidades por recolector/grupo y tarea/horas de auxiliares. */
export function informeParte(
  cabecera: CabeceraInforme,
  shift: ShiftInforme,
  workers: Worker[],
  entries: Entry[],
): InformeParte {
  const conteos = sumarConteos(entries);
  const nombre = new Map(workers.map((w) => [w.id, w.name]));
  const presentes = workers.filter((w) => shift.attendeeIds.includes(w.id));

  const recolectores: FilaRecolector[] = presentes
    .filter((w) => w.funcion !== "auxiliar")
    .map((w) => ({ nombre: w.name, unidades: conteos[w.id] ?? 0 }))
    .sort((a, b) => b.unidades - a.unidades || porNombre(a, b));

  const grupos: FilaGrupo[] = (shift.groups ?? []).map((g) => ({
    nombre: g.name,
    unidades: conteos[g.groupId] ?? 0,
    miembros: g.memberIds
      .map((id) => nombre.get(id) ?? "?")
      .sort((a, b) => a.localeCompare(b, "es")),
  }));

  const auxiliares: FilaAuxiliar[] = presentes
    .filter((w) => w.funcion === "auxiliar")
    .map((w) => {
      const a = shift.auxiliares?.find((x) => x.workerId === w.id);
      return { nombre: w.name, tarea: a?.tarea ?? "", horas: a?.horas ?? null };
    })
    .sort(porNombre);

  return {
    cabecera,
    recolectores,
    grupos,
    auxiliares,
    totalUnidades: totalJornada(conteos),
  };
}

/** Fecha ISO -> "DD/MM/AAAA". */
export function fechaES(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}
