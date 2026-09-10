/**
 * Cambia el plan de la organización de un usuario (mantenimiento manual, hasta
 * que Stripe esté en modo live). Toca SOLO `plan` / `planLimits` de la
 * `Organization` y (opcional) el rol del usuario.
 *
 * Uso (desde la raíz del repo, con MONGODB_URI en el entorno o en api/.env):
 *
 *   MONGODB_URI="mongodb+srv://..." \
 *     pnpm --filter @cuadrilla/api exec tsx scripts/set-plan.ts \
 *     vtornet@gmail.com company --role owner
 *
 * `plan` por defecto: company. `--role` opcional (owner | gestor | foreman).
 */
import mongoose from "mongoose";
import type { Plan } from "@cuadrilla/shared";
import { conectarMongo, desconectarMongo } from "../src/config/db";
import { User } from "../src/models/auth";
import { Modelos } from "../src/models/sync";
import { LIMITES_POR_PLAN } from "../src/lib/stripe";

const PLANES: Plan[] = ["free", "foreman", "company", "campaign"];
const ROLES = ["owner", "gestor", "foreman", "worker"] as const;

async function main(): Promise<void> {
  const [email, planArg, ...resto] = process.argv.slice(2);
  const plan = (planArg ?? "company") as Plan;
  const roleFlag = resto.indexOf("--role");
  const role = roleFlag >= 0 ? resto[roleFlag + 1] : undefined;

  if (!email || !PLANES.includes(plan)) {
    console.error(
      `Uso: set-plan.ts <email> [${PLANES.join("|")}] [--role ${ROLES.join("|")}]`,
    );
    process.exit(1);
  }
  if (role && !ROLES.includes(role as (typeof ROLES)[number])) {
    console.error(`Rol no válido: ${role}`);
    process.exit(1);
  }

  await conectarMongo();

  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    console.error(`No hay usuario con email ${email}. ¿Ha entrado ya en la app?`);
    await desconectarMongo();
    process.exit(1);
  }

  const orgId = user.organizationId;
  const antes = await Modelos.organization.findById(orgId).lean();
  console.log("Organización:", orgId);
  console.log("  antes :", {
    name: antes?.name,
    plan: antes?.plan,
    planLimits: antes?.planLimits,
    userRole: user.role,
  });

  await Modelos.organization.updateOne(
    { _id: orgId },
    {
      $set: {
        plan,
        planLimits: LIMITES_POR_PLAN[plan],
        updatedAt: Date.now(),
        serverUpdatedAt: new Date(),
      },
    },
  );
  if (role && role !== user.role) {
    await User.updateOne({ _id: user._id }, { $set: { role } });
  }

  const despues = await Modelos.organization.findById(orgId).lean();
  const userDespues = await User.findById(user._id).lean();
  console.log("  después:", {
    plan: despues?.plan,
    planLimits: despues?.planLimits,
    userRole: userDespues?.role,
  });
  console.log(
    "\nListo. El cliente lo recibe en el siguiente /sync (serverUpdatedAt bumpeado).",
  );

  await desconectarMongo();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
