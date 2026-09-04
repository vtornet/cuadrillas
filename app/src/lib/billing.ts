import { API_URL } from "./config";
import { auth } from "./auth/auth.svelte";

export type PlanPago = "foreman" | "company" | "campaign";

async function pedirUrl(ruta: string, body?: unknown): Promise<string> {
  const r = await fetch(`${API_URL}${ruta}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 503) throw new Error("no-configurado");
  if (!r.ok) throw new Error(`billing ${r.status}`);
  const { url } = (await r.json()) as { url: string };
  return url;
}

/** Lleva a Stripe Checkout para contratar un plan. */
export async function irACheckout(plan: PlanPago): Promise<void> {
  window.location.href = await pedirUrl("/billing/checkout", { plan });
}

/** Lleva al portal de cliente de Stripe (facturas, cancelar, cambiar tarjeta). */
export async function irAPortal(): Promise<void> {
  window.location.href = await pedirUrl("/billing/portal");
}
