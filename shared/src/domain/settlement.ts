import type { Entry } from "../types/entry";
import type { Rate } from "../types/rate";
import type { Shift } from "../types/shift";
import type { Worker } from "../types/worker";
import { resolverTarifa } from "./rates";

export interface LineaLiquidacion {
  productId: string;
  unitTypeId: string;
  unidades: number;
  /** Tarifa aplicada (centimos) si es uniforme; `null` si hubo varias o falta. */
  tarifaCentimos: number | null;
  importeCentimos: number;
  /** Alguna unidad de esta linea no tuvo tarifa vigente. */
  sinTarifa: boolean;
}

export interface LiquidacionTrabajador {
  workerId: string;
  name: string;
  lineas: LineaLiquidacion[];
  totalUnidades: number;
  /** Importe a destajo (unidades x tarifa). */
  importeCentimos: number;
  /** Dias distintos en que el trabajador participo en el periodo. */
  diasTrabajados: number;
  /** Transporte = transporte/dia del trabajador x diasTrabajados. */
  transporteCentimos: number;
  /** importeCentimos + transporteCentimos. */
  totalCentimos: number;
  tieneLineasSinTarifa: boolean;
}

export interface Liquidacion {
  desde: string;
  hasta: string;
  trabajadores: LiquidacionTrabajador[];
  totalUnidades: number;
  /** Suma del destajo de todos los trabajadores. */
  destajoCentimos: number;
  transporteCentimos: number;
  /** destajoCentimos + transporteCentimos. */
  totalCentimos: number;
  hayLineasSinTarifa: boolean;
}

interface Opciones {
  desde: string;
  hasta: string;
}

interface Acumulado {
  productId: string;
  unitTypeId: string;
  unidades: number;
  importeCentimos: number;
  sinTarifa: boolean;
  tarifas: Set<number>;
}

/**
 * Resumen por trabajador y periodo con importe segun tarifa y transporte.
 *
 * - La tarifa se resuelve por `Shift.fecha` (dia natural). Entradas del mismo
 *   producto en fechas con tarifas distintas se suman correctamente.
 * - Transporte: `Worker.transporteCentimos` por cada dia distinto en que el
 *   trabajador participa (asiste o registra algo) dentro del periodo.
 * - Dinero en centimos enteros. Las correcciones (cantidad negativa) restan.
 *
 * Funcion pura.
 */
export function calcularLiquidacion(
  shifts: Shift[],
  workers: Worker[],
  entries: Entry[],
  rates: Rate[],
  { desde, hasta }: Opciones,
): Liquidacion {
  const porWorker = new Map(workers.map((w) => [w.id, w]));
  const shiftsEnRango = new Map(
    shifts
      .filter((s) => s.deleted === 0 && s.fecha >= desde && s.fecha <= hasta)
      .map((s) => [s.id, s]),
  );

  const porTrabajador = new Map<string, Map<string, Acumulado>>();
  const diasPorTrabajador = new Map<string, Set<string>>();

  const anotaDia = (workerId: string, fecha: string): void => {
    let dias = diasPorTrabajador.get(workerId);
    if (!dias) {
      dias = new Set();
      diasPorTrabajador.set(workerId, dias);
    }
    dias.add(fecha);
  };

  // Asistencia (dias trabajados) a partir de attendeeIds.
  for (const s of shiftsEnRango.values()) {
    for (const workerId of s.attendeeIds) anotaDia(workerId, s.fecha);
  }

  for (const e of entries) {
    if (e.deleted) continue;
    const s = shiftsEnRango.get(e.shiftId);
    if (!s) continue;

    anotaDia(e.workerId, s.fecha); // por si no estaba en attendeeIds

    const clave = `${s.productId}|${s.unitTypeId}`;
    let mapa = porTrabajador.get(e.workerId);
    if (!mapa) {
      mapa = new Map();
      porTrabajador.set(e.workerId, mapa);
    }
    let acc = mapa.get(clave);
    if (!acc) {
      acc = {
        productId: s.productId,
        unitTypeId: s.unitTypeId,
        unidades: 0,
        importeCentimos: 0,
        sinTarifa: false,
        tarifas: new Set(),
      };
      mapa.set(clave, acc);
    }

    const tarifa = resolverTarifa(rates, s.productId, s.unitTypeId, s.fecha);
    acc.unidades += e.cantidad;
    if (tarifa) {
      acc.importeCentimos += e.cantidad * tarifa.amountPerUnit;
      acc.tarifas.add(tarifa.amountPerUnit);
    } else {
      acc.sinTarifa = true;
    }
  }

  // Todos los trabajadores con destajo o con asistencia.
  const ids = new Set<string>([
    ...porTrabajador.keys(),
    ...diasPorTrabajador.keys(),
  ]);

  const trabajadores: LiquidacionTrabajador[] = [...ids]
    .map((workerId) => {
      const mapa = porTrabajador.get(workerId) ?? new Map<string, Acumulado>();
      const lineas: LineaLiquidacion[] = [...mapa.values()]
        .map((a) => ({
          productId: a.productId,
          unitTypeId: a.unitTypeId,
          unidades: a.unidades,
          tarifaCentimos:
            !a.sinTarifa && a.tarifas.size === 1 ? [...a.tarifas][0] : null,
          importeCentimos: a.importeCentimos,
          sinTarifa: a.sinTarifa,
        }))
        .sort((x, y) => x.productId.localeCompare(y.productId));

      const importeCentimos = lineas.reduce((s, l) => s + l.importeCentimos, 0);
      const diasTrabajados = diasPorTrabajador.get(workerId)?.size ?? 0;
      const transportePorDia = porWorker.get(workerId)?.transporteCentimos ?? 0;
      const transporteCentimos = transportePorDia * diasTrabajados;

      return {
        workerId,
        name: porWorker.get(workerId)?.name ?? "?",
        lineas,
        totalUnidades: lineas.reduce((s, l) => s + l.unidades, 0),
        importeCentimos,
        diasTrabajados,
        transporteCentimos,
        totalCentimos: importeCentimos + transporteCentimos,
        tieneLineasSinTarifa: lineas.some((l) => l.sinTarifa),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const destajoCentimos = trabajadores.reduce(
    (s, t) => s + t.importeCentimos,
    0,
  );
  const transporteCentimos = trabajadores.reduce(
    (s, t) => s + t.transporteCentimos,
    0,
  );

  return {
    desde,
    hasta,
    trabajadores,
    totalUnidades: trabajadores.reduce((s, t) => s + t.totalUnidades, 0),
    destajoCentimos,
    transporteCentimos,
    totalCentimos: destajoCentimos + transporteCentimos,
    hayLineasSinTarifa: trabajadores.some((t) => t.tieneLineasSinTarifa),
  };
}
