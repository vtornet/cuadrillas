import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requiereAuth } from "../middleware/auth";
import { User } from "../models/auth";
import { stripe } from "../lib/stripe";
import { env } from "../config/env";
import {
  crearCheckout,
  crearPortal,
  procesarEventoStripe,
} from "../services/billingService";

export const billingRouter = Router();

const checkoutSchema = z.object({
  plan: z.enum(["foreman", "company", "campaign"]),
});

billingRouter.post("/checkout", requiereAuth, async (req, res, next) => {
  try {
    const { plan } = checkoutSchema.parse(req.body);
    const user = await User.findById(req.auth!.userId).lean<{ email?: string } | null>();
    const resultado = await crearCheckout(
      req.auth!.organizationId,
      user?.email ?? "",
      plan,
    );
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

billingRouter.post("/portal", requiereAuth, async (req, res, next) => {
  try {
    const url = await crearPortal(req.auth!.organizationId);
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

/**
 * Webhook de Stripe. Se monta con `express.raw` (cuerpo sin parsear) para poder
 * verificar la firma.
 */
export async function webhookStripe(req: Request, res: Response): Promise<void> {
  if (!stripe || !env.stripeWebhookSecret) {
    res.status(503).end();
    return;
  }
  const firma = req.header("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      firma ?? "",
      env.stripeWebhookSecret,
    );
  } catch {
    res.status(400).send("Firma invalida");
    return;
  }

  try {
    await procesarEventoStripe(event);
  } catch (e) {
    console.error("[webhook stripe]", e);
  }
  res.json({ received: true });
}
