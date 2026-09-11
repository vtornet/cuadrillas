import type { Entry } from "../types/entry";
import type { Shift } from "../types/shift";
import type { Worker } from "../types/worker";
import { sumarConteos, totalJornada } from "./entries";

/**
 * Informes de un parte para exportar (PDF / Excel). Puros, sin IO. Dos formas:
 * `InformeAsistencia` (solo la lista de trabajadores por rol) e `InformeParte`
 * (parte completo: unidades por recolector + tarea/horas de auxiliares).
 *
 * Los grupos no se listan aparte en los informes: sus miembros aparecen en la
 * lista de recolectores y sus unidades se reparten entre ellos (igual que la
 * liquidación y las estadísticas).
 */

export interface CabeceraInforme {
  /** Empresa / explotación (perfil del jefe). */
  empresa?: string;
  /** NIF / CIF del responsable (perfil del jefe). */
  nif?: string;
  cuadrilla: string;
  finca?: string;
  /** Fecha ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Etiqueta del producto ("Naranja · Navelina"). */
  producto: string;
  /** Nombre de la unidad ("Caja"). */
  unidad: string;
  /** Hora de inicio (HH:MM). */
  horaInicio?: string | null;
  /** Hora de finalización (HH:MM), si el parte está cerrado. */
  horaFin?: string | null;
  firmante?: string;
  /** Firma del jefe en PNG (data URL), si el parte está firmado. */
  firmaPng?: string;
  /** Observaciones libres del jefe de cuadrilla. */
  observaciones?: string;
}

export interface InformeAsistencia {
  cabecera: CabeceraInforme;
  recolectores: string[];
  auxiliares: string[];
}

export interface FilaRecolector {
  nombre: string;
  unidades: number;
}
export interface FilaAuxiliar {
  nombre: string;
  tarea: string;
  horas: number | null;
}

export interface InformeParte {
  cabecera: CabeceraInforme;
  /** Incluye a los miembros de grupos, con su parte repartida de las unidades. */
  recolectores: FilaRecolector[];
  auxiliares: FilaAuxiliar[];
  totalUnidades: number;
}

export interface FilaRecolectorHoras {
  nombre: string;
  /** `null` = sin horas anotadas todavía. */
  horas: number | null;
}

export interface InformeParteHoras {
  cabecera: CabeceraInforme;
  recolectores: FilaRecolectorHoras[];
  auxiliares: FilaAuxiliar[];
  /** Suma de las horas anotadas (ignora los que aún no tienen). */
  totalHoras: number;
  /** Total de envases del día, anotado en conjunto (`Shift.totalEnvases`). */
  totalEnvases: number | null;
  /** `totalEnvases` / nº de recolectores presentes, o `null` sin datos. */
  mediaEnvases: number | null;
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

  // Unidades por recolector: su registro individual más el reparto a partes
  // iguales de las unidades de cada grupo entre sus miembros presentes.
  const porRecolector = new Map<string, number>();
  for (const w of presentes) {
    if (w.funcion !== "auxiliar") porRecolector.set(w.id, conteos[w.id] ?? 0);
  }
  for (const g of shift.groups ?? []) {
    const uds = conteos[g.groupId] ?? 0;
    if (!uds || g.memberIds.length === 0) continue;
    const cuota = uds / g.memberIds.length;
    for (const id of g.memberIds) {
      if (!porRecolector.has(id)) continue;
      porRecolector.set(id, (porRecolector.get(id) ?? 0) + cuota);
    }
  }

  const recolectores: FilaRecolector[] = [...porRecolector]
    .map(([id, u]) => ({
      nombre: nombre.get(id) ?? "?",
      unidades: Math.round(u * 10) / 10,
    }))
    .sort((a, b) => b.unidades - a.unidades || porNombre(a, b));

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
    auxiliares,
    totalUnidades: totalJornada(conteos),
  };
}

type ShiftInformeHoras = Pick<
  Shift,
  "attendeeIds" | "auxiliares" | "horasRecolectores" | "totalEnvases"
>;

/**
 * Parte completo en modo "por horas": horas por recolector (sin unidades
 * individuales), tarea/horas de auxiliares (igual que en destajo), y el total
 * de envases del día con la media por recolector.
 */
export function informeParteHoras(
  cabecera: CabeceraInforme,
  shift: ShiftInformeHoras,
  workers: Worker[],
): InformeParteHoras {
  const presentes = workers.filter((w) => shift.attendeeIds.includes(w.id));
  const horasPorId = new Map(
    (shift.horasRecolectores ?? []).map((h) => [h.workerId, h.horas ?? null]),
  );

  const recolectores: FilaRecolectorHoras[] = presentes
    .filter((w) => w.funcion !== "auxiliar")
    .map((w) => ({ nombre: w.name, horas: horasPorId.get(w.id) ?? null }))
    .sort(porNombre);

  const auxiliares: FilaAuxiliar[] = presentes
    .filter((w) => w.funcion === "auxiliar")
    .map((w) => {
      const a = shift.auxiliares?.find((x) => x.workerId === w.id);
      return { nombre: w.name, tarea: a?.tarea ?? "", horas: a?.horas ?? null };
    })
    .sort(porNombre);

  const totalHoras = recolectores.reduce((n, r) => n + (r.horas ?? 0), 0);
  const totalEnvases = shift.totalEnvases ?? null;
  const mediaEnvases =
    totalEnvases != null && recolectores.length > 0
      ? Math.round((totalEnvases / recolectores.length) * 10) / 10
      : null;

  return {
    cabecera,
    recolectores,
    auxiliares,
    totalHoras: Math.round(totalHoras * 10) / 10,
    totalEnvases,
    mediaEnvases,
  };
}

/** Fecha ISO -> "DD/MM/AAAA". */
export function fechaES(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}
