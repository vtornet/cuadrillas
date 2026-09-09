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

export type FuncionTrabajador = "recolector" | "auxiliar";

export interface FilaAsistencia {
  workerId: string;
  name: string;
  alias: string;
  /** Rol del trabajador (`Worker.funcion`, ausente = recolector). */
  funcion: FuncionTrabajador;
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
  /** Recolectores primero, luego auxiliares; dentro de cada rol, por nombre. */
  filas: FilaAsistencia[];
  /** Trabajadores presentes por día (índice = posición en `dias`). */
  totalPorDia: number[];
  /** Presentes por día desglosados por rol. */
  totalPorDiaRol: Record<FuncionTrabajador, number[]>;
  /** Suma de todas las asistencias del mes. */
  totalGeneral: number;
  /** Fincas distintas trabajadas cada día (índice = posición en `dias`). */
  fincasPorDia: string[][];
  /** Fincas distintas trabajadas en el mes, ordenadas. */
  fincas: string[];
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
  // fecha -> set de fincas trabajadas ese día.
  const fincasPorFecha = new Map<string, Set<string>>();
  for (const s of shifts) {
    if (s.deleted !== 0 || !s.fecha.startsWith(prefijo)) continue;
    let set = presentesPorFecha.get(s.fecha);
    if (!set) {
      set = new Set();
      presentesPorFecha.set(s.fecha, set);
    }
    for (const id of s.attendeeIds) set.add(id);
    const f = s.finca?.trim();
    if (f) {
      let fs = fincasPorFecha.get(s.fecha);
      if (!fs) {
        fs = new Set();
        fincasPorFecha.set(s.fecha, fs);
      }
      fs.add(f);
    }
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
    filas.push({
      workerId: w.id,
      name: w.name,
      alias: w.alias,
      funcion: w.funcion === "auxiliar" ? "auxiliar" : "recolector",
      presente,
      total,
    });
  }

  const rango = (f: FilaAsistencia): number => (f.funcion === "auxiliar" ? 1 : 0);
  filas.sort(
    (a, b) => rango(a) - rango(b) || a.name.localeCompare(b.name, "es"),
  );

  const totalPorDia = dias.map(
    (_, i) => filas.reduce((n, f) => n + (f.presente[i] ? 1 : 0), 0),
  );
  const porRol = (rol: FuncionTrabajador): number[] =>
    dias.map((_, i) =>
      filas.reduce(
        (n, f) => n + (f.funcion === rol && f.presente[i] ? 1 : 0),
        0,
      ),
    );
  const totalPorDiaRol: Record<FuncionTrabajador, number[]> = {
    recolector: porRol("recolector"),
    auxiliar: porRol("auxiliar"),
  };
  const totalGeneral = totalPorDia.reduce((n, x) => n + x, 0);

  const fincasPorDia = dias.map((d) =>
    [...(fincasPorFecha.get(d.fecha) ?? [])].sort((a, b) =>
      a.localeCompare(b, "es"),
    ),
  );
  const fincas = [...new Set(fincasPorDia.flat())].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return {
    anio,
    mes,
    dias,
    filas,
    totalPorDia,
    totalPorDiaRol,
    totalGeneral,
    fincasPorDia,
    fincas,
  };
}
