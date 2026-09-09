import type { EntityName } from "@cuadrilla/shared";
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
