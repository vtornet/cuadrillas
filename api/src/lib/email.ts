import { env } from "../config/env";

/**
 * Envia el enlace magico. Sin `RESEND_API_KEY` (desarrollo), lo escribe en
 * consola en vez de enviarlo.
 */
export async function enviarEnlaceMagico(
  email: string,
  enlace: string,
): Promise<void> {
  if (!env.resendApiKey) {
    console.log(`\n[magic-link] ${email}\n  ${enlace}\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: email,
      subject: "Tu acceso a Cuadrilla",
      text: `Entra en Cuadrilla desde este enlace (caduca en 15 minutos):\n\n${enlace}\n`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend respondio ${res.status}`);
  }
}
