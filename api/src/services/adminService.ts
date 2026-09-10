import { randomUUID } from "node:crypto";
import type {
  EntityName,
  Entry,
  Rate,
  Shift,
  Worker,
} from "@cuadrilla/shared";
import {
  asistenciaMensual,
  calcularLiquidacion,
  normalizarLaboral,
  type AsistenciaMensual,
  type Liquidacion,
} from "@cuadrilla/shared/domain";
import type { DatosLaborales } from "@cuadrilla/shared";
import { Modelos, type DocBase } from "../models/sync";

/**
 * Consultas del panel de empresa (`/admin`). Solo lectura, sin LWW: leen de las
 * mismas colecciones que escribe `/sync`, filtrando por `organizationId`, y
 * devuelven los documentos en la forma que espera el cliente (`id`, `deleted`
 * como 0/1). El panel es online — nada de motor de sincronización.
 */

type Wire = Record<string, unknown>;

/** Doc de Mongo -> forma de cliente. */
function aWire(doc: DocBase): Wire {
  const { _id, serverUpdatedAt, deleted, ...resto } = doc;
  return { ...resto, id: _id, deleted: deleted ? 1 : 0 };
}

const VIVO = { deleted: { $ne: true } } as const;

async function listar(
  entity: EntityName,
  organizationId: string,
  extra: Record<string, unknown> = {},
): Promise<Wire[]> {
  const rows = await Modelos[entity]
    .find({ organizationId, ...VIVO, ...extra })
    .lean<DocBase[]>();
  return rows.map(aWire);
}

function mapa<T extends { id: unknown; name?: unknown }>(
  rows: T[],
): Map<unknown, string> {
  return new Map(rows.map((r) => [r.id, String(r.name ?? "?")]));
}

export async function resumen(organizationId: string): Promise<{
  cuadrillas: number;
  trabajadoresActivos: number;
  partesMes: number;
  partesAbiertos: number;
}> {
  const [cuadrillas, trabajadoresActivos, shifts] = await Promise.all([
    Modelos.crew.countDocuments({ organizationId, ...VIVO }),
    Modelos.worker.countDocuments({ organizationId, ...VIVO, activo: 1 }),
    Modelos.shift.find({ organizationId, ...VIVO }).lean<DocBase[]>(),
  ]);
  const mes = new Date().toISOString().slice(0, 7);
  return {
    cuadrillas,
    trabajadoresActivos,
    partesMes: shifts.filter((s) => String(s.fecha).startsWith(mes)).length,
    partesAbiertos: shifts.filter((s) => s.estado === "open").length,
  };
}

export async function cuadrillas(organizationId: string): Promise<Wire[]> {
  const [crews, workers] = await Promise.all([
    listar("crew", organizationId),
    listar("worker", organizationId),
  ]);
  return crews
    .map((c): Wire => ({
      ...c,
      numTrabajadores: workers.filter(
        (w) => w.crewId === c.id && w.activo === 1,
      ).length,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
}

export async function trabajadores(
  organizationId: string,
  filtros: { crewId?: string; q?: string } = {},
): Promise<Wire[]> {
  const [workers, crews] = await Promise.all([
    listar("worker", organizationId),
    listar("crew", organizationId),
  ]);
  const nombreCrew = mapa(crews as { id: unknown; name?: unknown }[]);
  let res = workers;
  if (filtros.crewId) res = res.filter((w) => w.crewId === filtros.crewId);
  if (filtros.q) {
    const q = filtros.q.toLocaleLowerCase("es");
    res = res.filter(
      (w) =>
        String(w.name).toLocaleLowerCase("es").includes(q) ||
        String(w.alias).toLocaleLowerCase("es").includes(q),
    );
  }
  return res
    .map((w): Wire => ({
      ...w,
      cuadrilla: nombreCrew.get(w.crewId) ?? "?",
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
}

export async function trabajador(
  organizationId: string,
  id: string,
): Promise<Wire | null> {
  const doc = await Modelos.worker
    .findOne({ _id: id, organizationId, ...VIVO })
    .lean<DocBase | null>();
  if (!doc) return null;
  const crew = await Modelos.crew
    .findOne({ _id: doc.crewId, organizationId })
    .lean<DocBase | null>();
  return { ...aWire(doc), cuadrilla: crew ? String(crew.name) : "?" };
}

/**
 * Escribe los datos laborales (alta) de un trabajador. Solo desde el panel.
 * Upsert con `serverUpdatedAt` para que el `/sync` del jefe lo reciba.
 */
export async function actualizarLaboral(
  organizationId: string,
  id: string,
  datos: Partial<Record<keyof DatosLaborales, string | undefined>>,
): Promise<Wire | null> {
  const existe = await Modelos.worker
    .findOne({ _id: id, organizationId, ...VIVO })
    .lean<DocBase | null>();
  if (!existe) return null;
  const limpio = normalizarLaboral(datos);
  const control = { updatedAt: Date.now(), serverUpdatedAt: new Date() };
  await Modelos.worker.updateOne(
    { _id: id, organizationId },
    limpio
      ? { $set: { laboral: limpio, ...control } }
      : { $unset: { laboral: "" }, $set: control },
  );
  const doc = await Modelos.worker.findById(id).lean<DocBase>();
  return aWire(doc!);
}

interface FiltrosPartes {
  crewId?: string;
  desde?: string;
  hasta?: string;
}

function conNombres(
  s: Wire,
  crews: Map<unknown, string>,
  products: Map<unknown, string>,
  units: Map<unknown, string>,
): Wire {
  return {
    ...s,
    cuadrilla: crews.get(s.crewId) ?? "?",
    producto: products.get(s.productId) ?? "?",
    unidad: units.get(s.unitTypeId) ?? "?",
  };
}

export async function partes(
  organizationId: string,
  filtros: FiltrosPartes = {},
): Promise<Wire[]> {
  const [shifts, crews, products, units] = await Promise.all([
    listar("shift", organizationId),
    listar("crew", organizationId),
    listar("product", organizationId),
    listar("unitType", organizationId),
  ]);
  const nc = mapa(crews as { id: unknown; name?: unknown }[]);
  const np = mapa(products as { id: unknown; name?: unknown }[]);
  const nu = mapa(units as { id: unknown; name?: unknown }[]);

  return shifts
    .filter((s) => !filtros.crewId || s.crewId === filtros.crewId)
    .filter((s) => !filtros.desde || String(s.fecha) >= filtros.desde)
    .filter((s) => !filtros.hasta || String(s.fecha) <= filtros.hasta)
    .map((s) => conNombres(s, nc, np, nu))
    .sort(
      (a, b) =>
        String(b.fecha).localeCompare(String(a.fecha)) ||
        Number(b.updatedAt) - Number(a.updatedAt),
    );
}

export async function parte(
  organizationId: string,
  id: string,
): Promise<Wire | null> {
  const doc = await Modelos.shift
    .findOne({ _id: id, organizationId, ...VIVO })
    .lean<DocBase | null>();
  if (!doc) return null;

  const [entries, workers, crew, product, unit] = await Promise.all([
    listar("entry", organizationId, { shiftId: id }),
    listar("worker", organizationId),
    Modelos.crew.findOne({ _id: doc.crewId, organizationId }).lean<DocBase | null>(),
    Modelos.product
      .findOne({ _id: doc.productId, organizationId })
      .lean<DocBase | null>(),
    Modelos.unitType
      .findOne({ _id: doc.unitTypeId, organizationId })
      .lean<DocBase | null>(),
  ]);

  const asistentes = new Set(
    (doc.attendeeIds as string[] | undefined) ?? [],
  );
  return {
    shift: {
      ...aWire(doc),
      cuadrilla: crew ? String(crew.name) : "?",
      producto: product ? String(product.name) : "?",
      unidad: unit ? String(unit.name) : "?",
    },
    entries,
    workers: workers.filter((w) => asistentes.has(w.id as string)),
  };
}

// ── Catálogos para los formularios ──────────────────────────────────────────

export async function productos(organizationId: string): Promise<Wire[]> {
  return (await listar("product", organizationId)).sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "es"),
  );
}

export async function unidades(organizationId: string): Promise<Wire[]> {
  return (await listar("unitType", organizationId)).sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "es"),
  );
}

// ── Tarifas (CRUD) ─────────────────────────────────────────────────────────

export async function tarifas(organizationId: string): Promise<Wire[]> {
  const [rates, prods, units] = await Promise.all([
    listar("rate", organizationId),
    listar("product", organizationId),
    listar("unitType", organizationId),
  ]);
  const np = mapa(prods as { id: unknown; name?: unknown }[]);
  const nu = mapa(units as { id: unknown; name?: unknown }[]);
  return rates
    .map((r): Wire => ({
      ...r,
      producto: np.get(r.productId) ?? "?",
      unidad: nu.get(r.unitTypeId) ?? "?",
    }))
    .sort(
      (a, b) =>
        String(a.producto).localeCompare(String(b.producto), "es") ||
        String(b.validFrom).localeCompare(String(a.validFrom)),
    );
}

export interface DatosTarifa {
  productId: string;
  unitTypeId: string;
  amountPerUnit: number;
  validFrom: string;
  validTo: string | null;
}

export async function crearTarifa(
  organizationId: string,
  datos: DatosTarifa,
): Promise<Wire> {
  const id = randomUUID();
  const ahora = new Date();
  await Modelos.rate.updateOne(
    { _id: id },
    {
      $set: {
        _id: id,
        organizationId,
        ...datos,
        updatedAt: Date.now(),
        serverUpdatedAt: ahora,
        deleted: false,
      },
    },
    { upsert: true },
  );
  const doc = await Modelos.rate.findById(id).lean<DocBase>();
  return aWire(doc!);
}

export async function actualizarTarifa(
  organizationId: string,
  id: string,
  datos: DatosTarifa,
): Promise<Wire | null> {
  const existe = await Modelos.rate
    .findOne({ _id: id, organizationId })
    .lean<DocBase | null>();
  if (!existe) return null;
  await Modelos.rate.updateOne(
    { _id: id, organizationId },
    { $set: { ...datos, updatedAt: Date.now(), serverUpdatedAt: new Date() } },
  );
  const doc = await Modelos.rate.findById(id).lean<DocBase>();
  return aWire(doc!);
}

export async function borrarTarifa(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const r = await Modelos.rate.updateOne(
    { _id: id, organizationId },
    { $set: { deleted: true, updatedAt: Date.now(), serverUpdatedAt: new Date() } },
  );
  return r.matchedCount > 0;
}

// ── Asistencia mensual ─────────────────────────────────────────────────────

export async function asistencia(
  organizationId: string,
  opts: { anio: number; mes: number; crewId?: string },
): Promise<AsistenciaMensual> {
  const [shifts, workers, entries] = await Promise.all([
    listar("shift", organizationId, opts.crewId ? { crewId: opts.crewId } : {}),
    listar("worker", organizationId, opts.crewId ? { crewId: opts.crewId } : {}),
    listar("entry", organizationId),
  ]);
  return asistenciaMensual(
    shifts as unknown as Shift[],
    workers as unknown as Worker[],
    opts.anio,
    opts.mes,
    entries as unknown as Entry[],
  );
}

// ── Liquidación por periodo ────────────────────────────────────────────────

export async function liquidacion(
  organizationId: string,
  opts: { desde: string; hasta: string; crewId?: string },
): Promise<Liquidacion> {
  const filtroCrew = opts.crewId ? { crewId: opts.crewId } : {};
  const [shifts, workers, entries, rates] = await Promise.all([
    listar("shift", organizationId, filtroCrew),
    listar("worker", organizationId, filtroCrew),
    listar("entry", organizationId),
    listar("rate", organizationId),
  ]);
  return calcularLiquidacion(
    shifts as unknown as Shift[],
    workers as unknown as Worker[],
    entries as unknown as Entry[],
    rates as unknown as Rate[],
    { desde: opts.desde, hasta: opts.hasta },
  );
}
