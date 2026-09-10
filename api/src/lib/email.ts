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
      subject: "Tu acceso a Cuadrillas",
      text: `Entra en Cuadrillas desde este enlace (caduca en 15 minutos):\n\n${enlace}\n`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend respondio ${res.status}`);
  }
}

/**
 * Invitación de un gestor de empresa a un jefe de cuadrilla. Mismo enlace
 * mágico, pero el mensaje explica el contexto y caduca a los 7 días.
 */
export async function enviarInvitacion(
  email: string,
  empresa: string,
  enlace: string,
): Promise<void> {
  const texto =
    `${empresa} te ha añadido como jefe de cuadrilla en Cuadrillas.\n\n` +
    `Abre la app desde este enlace para entrar (caduca en 7 días):\n\n${enlace}\n`;
  if (!env.resendApiKey) {
    console.log(`\n[invitacion → ${email}] (${empresa})\n  ${enlace}\n`);
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
      subject: `${empresa} te invita a Cuadrillas`,
      text: texto,
    }),
  });
  if (!res.ok) throw new Error(`Resend respondio ${res.status}`);
}
