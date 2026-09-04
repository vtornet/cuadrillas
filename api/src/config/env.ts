import "dotenv/config";

function requerido(nombre: string, fallback?: string): string {
  const v = process.env[nombre] ?? fallback;
  if (v === undefined) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  mongoUri: requerido("MONGODB_URI", "mongodb://127.0.0.1:27017/cuadrilla"),
  jwtSecret: requerido("JWT_SECRET", "dev-secret-no-usar-en-produccion"),
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Cuadrilla <login@cuadrilla.local>",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceForeman: process.env.STRIPE_PRICE_FOREMAN ?? "",
  stripePriceCompany: process.env.STRIPE_PRICE_COMPANY ?? "",
  stripePriceCampaign: process.env.STRIPE_PRICE_CAMPAIGN ?? "",
  get isProd(): boolean {
    return this.nodeEnv === "production";
  },
};
