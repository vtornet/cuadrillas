import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ErrorHttp } from "../lib/errores";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos invalidos", detalles: err.issues });
    return;
  }
  if (err instanceof ErrorHttp) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const msg = err instanceof Error ? err.message : "Error interno";
  console.error("[error]", err);
  res.status(500).json({ error: msg });
}
