import type {
  Crew,
  Idioma,
  Organization,
  Product,
  Shift,
  UnitType,
  Worker,
} from "@cuadrilla/shared";
import { LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import { db } from "../db/dexie";

/**
 * Datos de demostracion para poder probar la pantalla de Registro antes de
 * tener las pantallas de Jornada / Gestion (pasos 3 y 4) y el login (paso 5).
 *
 * IMPORTANTE: se escriben directamente, SIN encolar en `pendingOps`. No son
 * datos reales del usuario. El paso 5 los eliminara en el primer login/sync.
 */

const HOY = new Date().toISOString().slice(0, 10);
const ORG_ID = "demo-org";
const CREW_ID = "demo-crew";
const PRODUCT_ID = "demo-product";
const UNIT_ID = "demo-unit";
const USER_ID = "demo-user";

const NOMBRES: Array<[string, string]> = [
  ["Juan Perez", "JUAN"],
  ["Maria Lopez", "MARIA"],
  ["Ahmed Ben Ali", "AHMED"],
  ["Ion Popescu", "ION"],
  ["Fatima Zahra", "FATIMA"],
  ["Luis Garcia", "LUIS"],
  ["Elena Radu", "ELENA"],
  ["Mohamed Amine", "MOHAMED"],
];

export async function seedDemo(): Promise<void> {
  const yaHecho = await db.meta.get("demoSeed");
  if (yaHecho) return;

  const ahora = Date.now();

  const org: Organization = {
    id: ORG_ID,
    organizationId: ORG_ID,
    name: "Explotacion de demostracion",
    plan: "free",
    planLimits: { ...LIMITES_PLAN_GRATIS },
    updatedAt: ahora,
    deleted: 0,
  };

  const crew: Crew = {
    id: CREW_ID,
    organizationId: ORG_ID,
    name: "Cuadrilla 1",
    foremanIds: [USER_ID],
    updatedAt: ahora,
    deleted: 0,
  };

  const product: Product = {
    id: PRODUCT_ID,
    organizationId: ORG_ID,
    name: "Naranja",
    variedad: "Navelina",
    activo: 1,
    updatedAt: ahora,
    deleted: 0,
  };

  const unit: UnitType = {
    id: UNIT_ID,
    organizationId: ORG_ID,
    name: "Caja",
    abbr: "cj",
    productId: PRODUCT_ID,
    updatedAt: ahora,
    deleted: 0,
  };

  const workers: Worker[] = NOMBRES.map(([name, alias], i) => ({
    id: `demo-worker-${i + 1}`,
    organizationId: ORG_ID,
    name,
    alias,
    crewId: CREW_ID,
    language: "es" as Idioma,
    // El último es auxiliar (carga, paletizado…): no recolecta.
    funcion: i === NOMBRES.length - 1 ? ("auxiliar" as const) : undefined,
    activo: 1,
    qrCode: alias,
    updatedAt: ahora,
    deleted: 0,
  }));

  const shift: Shift = {
    id: "demo-shift",
    organizationId: ORG_ID,
    crewId: CREW_ID,
    fecha: HOY,
    horaInicio: "08:00",
    horaFin: null,
    productId: PRODUCT_ID,
    unitTypeId: UNIT_ID,
    estado: "open",
    attendeeIds: workers.map((w) => w.id),
    updatedAt: ahora,
    deleted: 0,
  };

  await db.transaction(
    "rw",
    [
      db.organizations,
      db.crews,
      db.products,
      db.unitTypes,
      db.workers,
      db.shifts,
      db.meta,
    ],
    async () => {
      await db.organizations.put(org);
      await db.crews.put(crew);
      await db.products.put(product);
      await db.unitTypes.put(unit);
      await db.workers.bulkPut(workers);
      await db.shifts.put(shift);
      await db.meta.put({ key: "demoSeed", value: true });
    },
  );
}
