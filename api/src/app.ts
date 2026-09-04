import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { syncRouter } from "./routes/sync";
import { billingRouter, webhookStripe } from "./routes/billing";
import { errorHandler } from "./middleware/errorHandler";

export function crearApp(): express.Express {
  const app = express();
  app.use(cors());

  // El webhook necesita el cuerpo sin parsear (verificacion de firma). Va antes
  // del middleware json.
  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    webhookStripe,
  );

  app.use(express.json({ limit: "8mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/auth", authRouter);
  app.use("/sync", syncRouter);
  app.use("/billing", billingRouter);

  app.use(errorHandler);
  return app;
}
