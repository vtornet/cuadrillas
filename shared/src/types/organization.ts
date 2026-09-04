export type Plan = "free" | "foreman" | "company" | "campaign";

export interface Organization {
  id: string;
  name: string;
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Estado de la suscripción en Stripe (`active`, `past_due`, `canceled`…). */
  subscriptionStatus?: string;
  /** Límites efectivos del plan actual (nº de cuadrillas y de trabajadores). */
  planLimits: {
    crews: number;
    workers: number;
  };
  updatedAt: number;
  deleted: 0 | 1;
}
