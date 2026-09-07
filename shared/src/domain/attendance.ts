import type { Shift } from "../types/shift";
import type { Worker } from "../types/worker";

/**
 * Tabla mensual de asistencia: filas = trabajadores, columnas = días del mes,
 * celda marcada si el trabajador figuraba en la asistencia (`Shift.attendeeIds`)
 * de algún parte de ese día. Puro, sin IO, sin datos económicos.
 */

export interface DiaAsistencia {
  /** Día del mes, 1..31. */
  dia: number;
  /** Fecha ISO `YYYY-MM-DD`. */
  fecha: string;
  /** 0 = lunes … 6 = domingo. */
  diaSemana: number;
  finDeSemana: boolean;
}

export interface FilaAsistencia {
  workerId: string;
  name: string;
  alias: string;
  /** `presente[i]` corresponde a `dias[i]`. */
  presente: boolean[];
  /** Nº de días asistidos en el mes. */
  total: number;
}

export interface AsistenciaMensual {
  anio: number;
  /** Mes 1..12. */
  mes: number;
  dias: DiaAsistencia[];
  filas: FilaAsistencia[];
  /** Trabajadores presentes por día (índice = posición en `dias`). */
  totalPorDia: number[];
  /** Suma de todas las asistencias del mes. */
  totalGeneral: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function asistenciaMensual(
  shifts: Shift[],
  workers: Worker[],
  anio: number,
  mes: number,
): AsistenciaMensual {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const prefijo = `${anio}-${pad2(mes)}-`;

  const dias: DiaAsistencia[] = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const dow = new Date(anio, mes - 1, d).getDay(); // 0 = domingo
    dias.push({
      dia: d,
      fecha: `${prefijo}${pad2(d)}`,
      diaSemana: (dow + 6) % 7, // 0 = lunes
      finDeSemana: dow === 0 || dow === 6,
    });
  }

  // fecha -> set de workerId presentes ese día (unión de attendeeIds).
  const presentesPorFecha = new Map<string, Set<string>>();
  for (const s of shifts) {
    if (s.deleted !== 0 || !s.fecha.startsWith(prefijo)) continue;
    let set = presentesPorFecha.get(s.fecha);
    if (!set) {
      set = new Set();
      presentesPorFecha.set(s.fecha, set);
    }
    for (const id of s.attendeeIds) set.add(id);
  }

  const filas: FilaAsistencia[] = [];
  for (const w of workers) {
    if (w.deleted !== 0) continue;
    const presente = dias.map(
      (d) => presentesPorFecha.get(d.fecha)?.has(w.id) ?? false,
    );
    const total = presente.reduce((n, p) => n + (p ? 1 : 0), 0);
    // Trabajador activo, o inactivo pero con actividad ese mes.
    if (w.activo !== 1 && total === 0) continue;
    filas.push({ workerId: w.id, name: w.name, alias: w.alias, presente, total });
  }

  filas.sort((a, b) => a.name.localeCompare(b.name, "es"));

  const totalPorDia = dias.map(
    (_, i) => filas.reduce((n, f) => n + (f.presente[i] ? 1 : 0), 0),
  );
  const totalGeneral = totalPorDia.reduce((n, x) => n + x, 0);

  return { anio, mes, dias, filas, totalPorDia, totalGeneral };
}
