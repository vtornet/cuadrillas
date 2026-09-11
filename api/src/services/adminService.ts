import { randomUUID } from "node:crypto";
import { MagicToken, User } from "../models/auth";
import { enviarInvitacion } from "../lib/email";
import { env } from "../config/env";
import { refrescarCuadrilla } from "./syncService";
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
      numTrabajadores: workers.filter((w) => w.crewId === c.id).length,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
}

async function limiteCuadrillas(organizationId: string): Promise<number> {
  const org = await Modelos.organization
    .findById(organizationId)
    .lean<{ planLimits?: { crews?: number } } | null>();
  return org?.planLimits?.crews ?? 2;
}

export async function crearCuadrilla(
  organizationId: string,
  name: string,
): Promise<{ error: string } | { id: string }> {
  const activas = await Modelos.crew.countDocuments({ organizationId, ...VIVO });
  const limite = await limiteCuadrillas(organizationId);
  if (activas >= limite) {
    return { error: `El plan actual permite ${limite} cuadrillas.` };
  }
  const id = randomUUID();
  await Modelos.crew.updateOne(
    { _id: id },
    {
      $set: {
        _id: id,
        organizationId,
        name: name.trim(),
        foremanIds: [],
        updatedAt: Date.now(),
        serverUpdatedAt: new Date(),
        deleted: false,
      },
    },
    { upsert: true },
  );
  return { id };
}

export async function renombrarCuadrilla(
  organizationId: string,
  id: string,
  name: string,
): Promise<Wire | null> {
  const c = await Modelos.crew
    .findOne({ _id: id, organizationId, ...VIVO })
    .lean<DocBase | null>();
  if (!c) return null;
  await Modelos.crew.updateOne(
    { _id: id, organizationId },
    { $set: { name: name.trim(), updatedAt: Date.now(), serverUpdatedAt: new Date() } },
  );
  return aWire((await Modelos.crew.findById(id).lean<DocBase>())!);
}

export async function borrarCuadrilla(
  organizationId: string,
  id: string,
): Promise<{ error: string } | { ok: true }> {
  const c = await Modelos.crew
    .findOne({ _id: id, organizationId, ...VIVO })
    .lean<DocBase | null>();
  if (!c) return { error: "Cuadrilla no encontrada" };
  const n = await Modelos.worker.countDocuments({
    organizationId,
    crewId: id,
    ...VIVO,
  });
  if (n > 0) {
    return {
      error: `La cuadrilla tiene ${n} trabajador(es). Muévelos a otra cuadrilla antes de eliminarla.`,
    };
  }
  await Modelos.crew.updateOne(
    { _id: id, organizationId },
    { $set: { deleted: true, updatedAt: Date.now(), serverUpdatedAt: new Date() } },
  );
  return { ok: true };
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

// ── Equipo: jefes de cuadrilla e invitaciones ──────────────────────────────

interface Jefe {
  id: string;
  email: string;
  role: string;
  cuadrillas: { id: string; name: string }[];
}

interface EquipoResumen {
  jefes: Jefe[];
  invitaciones: { token: string; email: string; expiresAt: string }[];
  limite: number;
  /** jefes actuales + invitaciones pendientes. */
  ocupados: number;
}

async function limiteJefes(organizationId: string): Promise<number> {
  const org = await Modelos.organization
    .findById(organizationId)
    .lean<{ planLimits?: { foremen?: number } } | null>();
  return org?.planLimits?.foremen ?? 1;
}

export async function equipo(organizationId: string): Promise<EquipoResumen> {
  const [users, crews, invites] = await Promise.all([
    User.find({ organizationId }).lean<
      { _id: string; email: string; role: string }[]
    >(),
    listar("crew", organizationId),
    MagicToken.find({
      inviteOrg: organizationId,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean<{ token: string; email: string; expiresAt: Date }[]>(),
  ]);

  const jefes: Jefe[] = users
    .filter((u) => u.role === "foreman" || u.role === "owner")
    .map((u) => ({
      id: u._id,
      email: u.email,
      role: u.role,
      cuadrillas: crews
        .filter((c) => ((c.foremanIds as string[]) ?? []).includes(u._id))
        .map((c) => ({ id: c.id as string, name: String(c.name) })),
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

  const invitaciones = invites
    .map((i) => ({
      token: i.token,
      email: i.email,
      expiresAt: i.expiresAt.toISOString(),
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

  const limite = await limiteJefes(organizationId);
  return {
    jefes,
    invitaciones,
    limite,
    ocupados:
      jefes.filter((j) => j.role === "foreman").length +
      1 + // el owner cuenta como jefe
      invitaciones.length,
  };
}

export async function invitar(
  organizationId: string,
  email: string,
  crewIds: string[],
): Promise<{ error?: string; token?: string; enlace?: string }> {
  const limpio = email.trim().toLowerCase();

  const eq = await equipo(organizationId);
  if (eq.ocupados >= eq.limite) {
    return {
      error: `El plan actual permite ${eq.limite} jefe(s) de cuadrilla. Cambia al plan Empresa para invitar a más.`,
    };
  }
  if (await User.exists({ email: limpio })) {
    return { error: "Ese email ya tiene una cuenta en Cuadrillas." };
  }
  if (eq.invitaciones.some((i) => i.email === limpio)) {
    return { error: "Ya hay una invitación pendiente para ese email." };
  }

  const crewsValidas = (await listar("crew", organizationId))
    .map((c) => c.id as string)
    .filter((id) => crewIds.includes(id));

  const token = randomUUID();
  await MagicToken.create({
    token,
    email: limpio,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    inviteOrg: organizationId,
    inviteRole: "foreman",
    inviteCrewIds: crewsValidas,
  });

  const org = await Modelos.organization
    .findById(organizationId)
    .lean<{ name?: string } | null>();
  const enlace = `${env.appUrl}/#/entrar?token=${token}`;
  await enviarInvitacion(limpio, org?.name ?? "Tu empresa", enlace);

  return { token, ...(env.isProd ? {} : { enlace }) };
}

export async function revocarInvitacion(
  organizationId: string,
  token: string,
): Promise<boolean> {
  const r = await MagicToken.deleteOne({
    token,
    inviteOrg: organizationId,
    usedAt: null,
  });
  return r.deletedCount > 0;
}

/** Fija exactamente qué cuadrillas lidera un jefe (añade/quita en bloque). */
export async function asignarCuadrillas(
  organizationId: string,
  userId: string,
  crewIds: string[],
): Promise<{ error?: string } | { ok: true }> {
  const u = await User.findOne({ _id: userId, organizationId }).lean();
  if (!u) return { error: "Jefe no encontrado" };

  // Cuadrillas de las que YA era jefe, para saber cuáles ganan un jefe nuevo
  // (esas hay que "refrescar": ver refrescarCuadrilla).
  const antes = await Modelos.crew
    .find({ organizationId, foremanIds: userId })
    .distinct("_id");
  const nuevas = crewIds.filter((id) => !antes.includes(id));

  await Modelos.crew.updateMany(
    { organizationId, _id: { $in: crewIds } },
    {
      $addToSet: { foremanIds: userId },
      $set: { updatedAt: Date.now(), serverUpdatedAt: new Date() },
    },
  );
  await Modelos.crew.updateMany(
    { organizationId, _id: { $nin: crewIds }, foremanIds: userId },
    {
      $pull: { foremanIds: userId },
      $set: { updatedAt: Date.now(), serverUpdatedAt: new Date() },
    },
  );

  // El sync es por cuadrilla (cursor por fecha): sin esto, un jefe con
  // lastSyncAt ya avanzado no vería el historial de una cuadrilla nueva.
  for (const crewId of nuevas) await refrescarCuadrilla(organizationId, crewId);

  return { ok: true };
}
