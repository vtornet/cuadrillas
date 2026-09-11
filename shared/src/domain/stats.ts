import type { Entry } from "../types/entry";
import type { Shift } from "../types/shift";
import type { Worker } from "../types/worker";

export interface FilaTrabajador {
  workerId: string;
  name: string;
  unidades: number;
  /** Horas de jornada imputadas al trabajador. */
  horas: number;
  unidadesPorHora: number | null;
}

export interface Estadisticas {
  /** Filas ordenadas de mas a menos unidades (ranking). */
  filas: FilaTrabajador[];
  totalUnidades: number;
  /** Media de unidades entre los trabajadores con actividad. */
  mediaUnidades: number;
  totalHoras: number;
  /** Unidades/hora de la cuadrilla (total unidades / total horas). */
  mediaUnidadesPorHora: number | null;
  /** Unidades por dia natural, ordenado por fecha. */
  evolucion: Array<{ fecha: string; unidades: number }>;
  numTrabajadores: number;
}

export interface OpcionesStats {
  /** Minutos transcurridos del dia actual (para jornadas aun abiertas). */
  ahoraMin?: number;
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/**
 * Horas de una jornada. Si esta abierta (`horaFin` nulo), cuenta hasta
 * `ahoraMin`, con un tope de 16 h. Sin `horaInicio` devuelve 0.
 */
export function horasDeJornada(
  shift: Pick<Shift, "horaInicio" | "horaFin">,
  ahoraMin?: number,
): number {
  if (!shift.horaInicio) return 0;
  const inicio = aMinutos(shift.horaInicio);
  const fin = shift.horaFin ? aMinutos(shift.horaFin) : (ahoraMin ?? inicio);
  const horas = (fin - inicio) / 60;
  if (horas <= 0) return 0;
  return Math.min(horas, 16);
}

/**
 * Estadisticas de un conjunto de jornadas: unidades por trabajador,
 * unidades/hora, media de la cuadrilla, ranking y evolucion diaria.
 * Funcion pura.
 */
export function calcularEstadisticas(
  shifts: Shift[],
  workers: Worker[],
  entries: Entry[],
  opts: OpcionesStats = {},
): Estadisticas {
  const nombre = new Map(workers.map((w) => [w.id, w.name]));
  const porShift = new Map(shifts.map((s) => [s.id, s]));
  // Los auxiliares no recolectan: fuera del ranking, medias y unidades/hora.
  const esAuxiliar = new Set(
    workers.filter((w) => w.funcion === "auxiliar").map((w) => w.id),
  );

  const unidades = new Map<string, number>();
  const evolucionMap = new Map<string, number>();

  for (const e of entries) {
    if (e.deleted) continue;
    const s = porShift.get(e.shiftId);
    if (!s) continue;

    if (e.workerId && !esAuxiliar.has(e.workerId)) {
      unidades.set(e.workerId, (unidades.get(e.workerId) ?? 0) + e.cantidad);
    } else if (e.groupId) {
      // Registro de grupo: se reparte a partes iguales entre los miembros del
      // snapshot de ESA jornada (igual criterio que `settlement.ts`).
      const miembros = s.groups?.find((g) => g.groupId === e.groupId)?.memberIds;
      if (miembros && miembros.length > 0) {
        const cuota = e.cantidad / miembros.length;
        for (const wid of miembros) {
          if (esAuxiliar.has(wid)) continue;
          unidades.set(wid, (unidades.get(wid) ?? 0) + cuota);
        }
      }
    }
    evolucionMap.set(s.fecha, (evolucionMap.get(s.fecha) ?? 0) + e.cantidad);
  }

  // Horas imputadas: suma de horas de las jornadas a las que el trabajador
  // asistio. Los partes "por horas" quedan fuera: no tienen unidades
  // individuales, así que contarían horas sin destajo y falsearían las
  // unidades/hora (igual criterio que los auxiliares).
  const horasPorTrabajador = new Map<string, number>();
  for (const s of shifts) {
    if (s.modo === "horas") continue;
    const h = horasDeJornada(s, opts.ahoraMin);
    if (h <= 0) continue;
    const asistentes =
      s.attendeeIds.length > 0
        ? s.attendeeIds
        : entries
            .filter((e) => e.shiftId === s.id)
            .map((e) => e.workerId)
            .filter((id): id is string => !!id);
    for (const w of new Set(asistentes)) {
      if (esAuxiliar.has(w)) continue;
      horasPorTrabajador.set(w, (horasPorTrabajador.get(w) ?? 0) + h);
    }
  }

  const participantes = new Set<string>([
    ...unidades.keys(),
    ...horasPorTrabajador.keys(),
  ]);

  const filas: FilaTrabajador[] = [...participantes]
    .map((id) => {
      const u = unidades.get(id) ?? 0;
      const h = horasPorTrabajador.get(id) ?? 0;
      return {
        workerId: id,
        name: nombre.get(id) ?? "?",
        // El reparto de grupos puede dar decimales.
        unidades: redondear(u, 1),
        horas: redondear(h, 2),
        unidadesPorHora: h > 0 ? redondear(u / h, 2) : null,
      };
    })
    .sort(
      (a, b) => b.unidades - a.unidades || a.name.localeCompare(b.name, "es"),
    );

  const totalUnidadesRaw = [...unidades.values()].reduce((a, b) => a + b, 0);
  const totalUnidades = redondear(totalUnidadesRaw, 1);
  const totalHoras = redondear(
    [...horasPorTrabajador.values()].reduce((a, b) => a + b, 0),
    2,
  );
  const conActividad = filas.filter((f) => f.unidades > 0).length;

  const evolucion = [...evolucionMap.entries()]
    .map(([fecha, u]) => ({ fecha, unidades: u }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    filas,
    totalUnidades,
    mediaUnidades:
      conActividad > 0 ? redondear(totalUnidadesRaw / conActividad, 1) : 0,
    totalHoras,
    mediaUnidadesPorHora:
      totalHoras > 0 ? redondear(totalUnidadesRaw / totalHoras, 2) : null,
    evolucion,
    numTrabajadores: participantes.size,
  };
}
