import { API_URL } from "./config";
import { auth } from "./auth/auth.svelte";

export type PlanPago = "foreman" | "company" | "campaign";

interface RespuestaCheckout {
  url?: string;
  actualizado?: true;
}

async function pedirJson<T>(ruta: string, body?: unknown): Promise<T> {
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
  return (await r.json()) as T;
}

/**
 * Contrata un plan o cambia al indicado. Si la organización ya tenía una
 * suscripción activa y el nuevo plan también es una suscripción, el servidor
 * la actualiza in situ (sin checkout nuevo, para no duplicar el cobro) y esta
 * función resuelve con `{ actualizado: true }` sin navegar a ningún sitio —
 * quien llama debe refrescar el plan. En cualquier otro caso (alta nueva, o
 * "campaign", que es pago único) navega a Stripe Checkout.
 */
export async function irACheckout(plan: PlanPago): Promise<{ actualizado: boolean }> {
  const r = await pedirJson<RespuestaCheckout>("/billing/checkout", { plan });
  if (r.url) {
    window.location.href = r.url;
    return { actualizado: false };
  }
  return { actualizado: true };
}

/** Lleva al portal de cliente de Stripe (facturas, cancelar, cambiar tarjeta). */
export async function irAPortal(): Promise<void> {
  const { url } = await pedirJson<{ url: string }>("/billing/portal");
  window.location.href = url;
}
