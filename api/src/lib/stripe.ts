import Stripe from "stripe";
import type { Plan } from "@cuadrilla/shared";
import { LIMITES_PLAN_GRATIS } from "@cuadrilla/shared";
import { env } from "../config/env";

/** Cliente de Stripe, o `null` si no hay clave configurada. */
export const stripe = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey)
  : null;

export type PlanPago = Exclude<Plan, "free">;

export const PRECIOS: Record<PlanPago, string> = {
  foreman: env.stripePriceForeman,
  company: env.stripePriceCompany,
  campaign: env.stripePriceCampaign,
};

/** `payment` (pago unico) para campana; `subscription` para el resto. */
export function modoCheckout(plan: PlanPago): "payment" | "subscription" {
  return plan === "campaign" ? "payment" : "subscription";
}

export const LIMITES_POR_PLAN: Record<Plan, { crews: number; workers: number }> =
  {
    free: {
      crews: LIMITES_PLAN_GRATIS.crews,
      workers: LIMITES_PLAN_GRATIS.workers,
    },
    foreman: { crews: 2, workers: 60 },
    company: { crews: 25, workers: 750 },
    campaign: { crews: 3, workers: 120 },
  };

export function planDePrecio(priceId: string): Plan | null {
  for (const [plan, id] of Object.entries(PRECIOS)) {
    if (id && id === priceId) return plan as Plan;
  }
  return null;
}
