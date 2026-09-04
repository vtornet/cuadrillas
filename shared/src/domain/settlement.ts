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
  /** Importe a destajo (unidades x tarifa). Incluye el reparto de grupos. */
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

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resumen por trabajador y periodo con importe segun tarifa y transporte.
 *
 * - La tarifa se resuelve por `Shift.fecha` (dia natural). Entradas del mismo
 *   producto en fechas con tarifas distintas se suman correctamente.
 * - Registros de grupo (`Entry.groupId`): el importe se reparte a partes
 *   iguales entre los miembros del grupo tal como estaban configurados en esa
 *   jornada (`Shift.groups`), en centimos exactos (sin perder ni un centimo
 *   por redondeo: el resto se reparte de uno en uno). Las unidades tambien se
 *   reparten a partes iguales (pueden salir con decimales).
 * - Transporte: `Worker.transporteCentimos` por cada dia distinto en que el
 *   trabajador participa (asiste o registra algo, individualmente o en
 *   grupo) dentro del periodo.
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

  const acumular = (
    workerId: string,
    productId: string,
    unitTypeId: string,
    unidades: number,
    importeCentimos: number,
    tarifaCentimos: number | null,
  ): void => {
    const clave = `${productId}|${unitTypeId}`;
    let mapa = porTrabajador.get(workerId);
    if (!mapa) {
      mapa = new Map();
      porTrabajador.set(workerId, mapa);
    }
    let acc = mapa.get(clave);
    if (!acc) {
      acc = {
        productId,
        unitTypeId,
        unidades: 0,
        importeCentimos: 0,
        sinTarifa: false,
        tarifas: new Set(),
      };
      mapa.set(clave, acc);
    }
    acc.unidades += unidades;
    acc.importeCentimos += importeCentimos;
    if (tarifaCentimos === null) acc.sinTarifa = true;
    else acc.tarifas.add(tarifaCentimos);
  };

  // Asistencia (dias trabajados) a partir de attendeeIds.
  for (const s of shiftsEnRango.values()) {
    for (const workerId of s.attendeeIds) anotaDia(workerId, s.fecha);
  }

  for (const e of entries) {
    if (e.deleted) continue;
    const s = shiftsEnRango.get(e.shiftId);
    if (!s) continue;

    const tarifa = resolverTarifa(rates, s.productId, s.unitTypeId, s.fecha);
    const tarifaCentimos = tarifa?.amountPerUnit ?? null;

    if (e.groupId) {
      const miembros = s.groups?.find((g) => g.groupId === e.groupId)
        ?.memberIds;
      if (!miembros || miembros.length === 0) continue;

      const n = miembros.length;
      const unidadPorMiembro = e.cantidad / n;
      const importeTotal = tarifa ? e.cantidad * tarifa.amountPerUnit : 0;
      const base = Math.floor(importeTotal / n);
      const resto = importeTotal - base * n; // entero en [0, n)
      const ordenados = [...miembros].sort();

      ordenados.forEach((workerId, i) => {
        anotaDia(workerId, s.fecha);
        acumular(
          workerId,
          s.productId,
          s.unitTypeId,
          unidadPorMiembro,
          base + (i < resto ? 1 : 0),
          tarifaCentimos,
        );
      });
      continue;
    }

    if (!e.workerId) continue;
    anotaDia(e.workerId, s.fecha);
    acumular(
      e.workerId,
      s.productId,
      s.unitTypeId,
      e.cantidad,
      tarifa ? e.cantidad * tarifa.amountPerUnit : 0,
      tarifaCentimos,
    );
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
          unidades: redondear2(a.unidades),
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
        totalUnidades: redondear2(lineas.reduce((s, l) => s + l.unidades, 0)),
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
    totalUnidades: redondear2(
      trabajadores.reduce((s, t) => s + t.totalUnidades, 0),
    ),
    destajoCentimos,
    transporteCentimos,
    totalCentimos: destajoCentimos + transporteCentimos,
    hayLineasSinTarifa: trabajadores.some((t) => t.tieneLineasSinTarifa),
  };
}
