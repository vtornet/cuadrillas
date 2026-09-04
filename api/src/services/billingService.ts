import type Stripe from "stripe";
import type { Plan } from "@cuadrilla/shared";
import { env } from "../config/env";
import { Modelos } from "../models/sync";
import { BillingNoConfigurado, ErrorHttp } from "../lib/errores";
import {
  LIMITES_POR_PLAN,
  PRECIOS,
  planDePrecio,
  stripe,
  modoCheckout,
  type PlanPago,
} from "../lib/stripe";

export async function crearCheckout(
  organizationId: string,
  email: string,
  plan: PlanPago,
): Promise<string> {
  if (!stripe) throw new BillingNoConfigurado();
  const priceId = PRECIOS[plan];
  if (!priceId) throw new ErrorHttp(400, `Sin precio configurado para "${plan}"`);

  const org = await Modelos.organization
    .findById(organizationId)
    .lean<{ stripeCustomerId?: string } | null>();

  const session = await stripe.checkout.sessions.create({
    mode: modoCheckout(plan),
    line_items: [{ price: priceId, quantity: 1 }],
    customer: org?.stripeCustomerId || undefined,
    customer_email: org?.stripeCustomerId ? undefined : email || undefined,
    client_reference_id: organizationId,
    metadata: { organizationId, plan },
    success_url: `${env.appUrl}/#/cuenta?checkout=success`,
    cancel_url: `${env.appUrl}/#/cuenta?checkout=cancel`,
  });

  if (!session.url) throw new ErrorHttp(502, "Stripe no devolvio URL");
  return session.url;
}

export async function crearPortal(organizationId: string): Promise<string> {
  if (!stripe) throw new BillingNoConfigurado();
  const org = await Modelos.organization
    .findById(organizationId)
    .lean<{ stripeCustomerId?: string } | null>();
  if (!org?.stripeCustomerId) {
    throw new ErrorHttp(400, "Esta organizacion no tiene suscripcion activa");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${env.appUrl}/#/cuenta`,
  });
  return session.url;
}

/** Aplica un evento de Stripe al plan de la organizacion. */
export async function procesarEventoStripe(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const organizationId =
        s.metadata?.organizationId ?? s.client_reference_id ?? null;
      if (!organizationId) return;
      const plan = (s.metadata?.plan as Plan | undefined) ?? "foreman";
      await actualizarPlan(organizationId, plan, {
        stripeCustomerId: idDe(s.customer),
        stripeSubscriptionId: idDe(s.subscription),
        subscriptionStatus: s.mode === "payment" ? "campaign_paid" : "active",
      });
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const org = await Modelos.organization
        .findOne({ stripeSubscriptionId: sub.id })
        .lean<{ _id: string } | null>();
      if (!org) return;

      const activa = sub.status === "active" || sub.status === "trialing";
      const priceId = sub.items?.data?.[0]?.price?.id;
      const plan: Plan = activa
        ? (priceId && planDePrecio(priceId)) || "foreman"
        : "free";

      await actualizarPlan(org._id, plan, { subscriptionStatus: sub.status });
      return;
    }
  }
}

function idDe(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

async function actualizarPlan(
  organizationId: string,
  plan: Plan,
  extra: Record<string, string | undefined>,
): Promise<void> {
  const set: Record<string, unknown> = {
    plan,
    planLimits: LIMITES_POR_PLAN[plan],
    updatedAt: Date.now(),
    serverUpdatedAt: new Date(),
  };
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) set[k] = v;
  }
  await Modelos.organization.updateOne({ _id: organizationId }, { $set: set });
}
