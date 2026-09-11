import type { Entry } from "../types/entry";
import type { Shift } from "../types/shift";
import type { Worker } from "../types/worker";

/**
 * RGPD: informe de los datos personales de un trabajador (derecho de acceso /
 * portabilidad) y anonimizacion (derecho de supresion, conservando el historico
 * agregado). Todo puro, sin IO. Sin importes — el jefe de cuadrilla no maneja
 * datos economicos.
 */

/** Resuelve ids a nombres legibles (cuadrilla, producto, unidad). */
export interface ResolutoresNombre {
  crew: (id: string) => string;
  producto: (id: string) => string;
  unidad: (id: string) => string;
}

export interface DiaInforme {
  fecha: string;
  cuadrilla: string;
  producto: string;
  unidad: string;
  /** Nº de anotaciones individuales (no anuladas) del trabajador ese día. */
  numAnotaciones: number;
  /** Suma de cantidades de esas anotaciones. */
  totalUnidades: number;
  /** El trabajador figuraba en la asistencia del parte. */
  presente: boolean;
  /** El parte se trabajó por grupos: las unidades no se registran por persona. */
  porGrupos: boolean;
}

export interface InformeTrabajador {
  worker: {
    id: string;
    name: string;
    alias: string;
    cuadrilla: string;
    codigoQr: string | null;
    transporteCentimos: number;
  };
  /** ISO 8601 del momento en que se generó. */
  generadoEl: string;
  dias: DiaInforme[];
  totalDias: number;
  totalUnidades: number;
}

/**
 * Reúne todos los datos personales de `worker`: su ficha + cada día en que
 * participó (por asistencia o por tener anotaciones), con el detalle de unidades
 * de ESE trabajador. Los partes trabajados por grupos se listan como día
 * presente pero sin desglose individual (mismo gap conocido que Estadísticas).
 */
export function informeTrabajador(
  worker: Worker,
  shifts: Shift[],
  entries: Entry[],
  nombres: ResolutoresNombre,
  generadoEl: Date = new Date(),
): InformeTrabajador {
  const suyas = entries.filter(
    (e) => e.deleted === 0 && e.workerId === worker.id,
  );
  const porShift = new Map<string, Entry[]>();
  for (const e of suyas) {
    const arr = porShift.get(e.shiftId);
    if (arr) arr.push(e);
    else porShift.set(e.shiftId, [e]);
  }

  const dias: DiaInforme[] = shifts
    .filter(
      (s) =>
        s.deleted === 0 &&
        (s.attendeeIds.includes(worker.id) || porShift.has(s.id)),
    )
    .sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || a.updatedAt - b.updatedAt,
    )
    .map((s) => {
      const es = porShift.get(s.id) ?? [];
      return {
        fecha: s.fecha,
        cuadrilla: nombres.crew(s.crewId),
        producto: nombres.producto(s.productId),
        unidad: nombres.unidad(s.unitTypeId),
        numAnotaciones: es.length,
        totalUnidades: es.reduce((n, e) => n + e.cantidad, 0),
        presente: s.attendeeIds.includes(worker.id),
        porGrupos: !!s.groups && s.groups.length > 0,
      };
    });

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      alias: worker.alias,
      cuadrilla: nombres.crew(worker.crewId),
      codigoQr: worker.qrCode ?? null,
      transporteCentimos: worker.transporteCentimos ?? 0,
    },
    generadoEl: generadoEl.toISOString(),
    dias,
    totalDias: dias.length,
    totalUnidades: dias.reduce((n, d) => n + d.totalUnidades, 0),
  };
}

/** Alias genérico para un trabajador anonimizado (único por id). */
export function aliasAnonimo(workerId: string): string {
  return `ELIMINADO-${workerId.slice(0, 8).toUpperCase()}`;
}

/**
 * Versión anonimizada de un trabajador: se conserva el registro (para que el
 * histórico siga resolviendo "quién" como "Trabajador eliminado") pero se borran
 * todos los datos personales. No es una lápida (`deleted` sigue a 0).
 * `nombreGenerico` lo pasa la capa de UI ya traducido.
 */
export function anonimizarWorker(worker: Worker, nombreGenerico: string): Worker {
  return {
    ...worker,
    name: nombreGenerico,
    alias: aliasAnonimo(worker.id),
    qrCode: undefined,
    transporteCentimos: 0,
    laboral: undefined,
    activo: 0,
    updatedAt: Date.now(),
    deleted: 0,
  };
}
