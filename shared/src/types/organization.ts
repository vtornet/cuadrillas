import type { RegistroSincronizable } from "./base";

export type Plan = "free" | "foreman" | "company" | "campaign";

/**
 * En una organización, `organizationId` (heredado de `RegistroSincronizable`)
 * coincide con su propio `id` — lo fija el servidor. Está para que la capa de
 * sync trate la organización igual que al resto de entidades.
 */
export interface Organization extends RegistroSincronizable {
  /** Nombre de la empresa o explotación. */
  name: string;
  /** Nombre de la persona responsable (jefe de cuadrilla): firma de partes, cabeceras. */
  contactName?: string;
  /** Teléfono de contacto (opcional). */
  contactPhone?: string;
  /** NIF/CIF para documentos y liquidaciones (opcional). */
  taxId?: string;
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
}
