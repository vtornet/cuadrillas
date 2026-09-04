import type { NextFunction, Request, Response } from "express";
import { verificarToken } from "../lib/jwt";

export function requiereAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const cabecera = req.header("authorization");
  const token = cabecera?.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Falta el token" });
    return;
  }
  try {
    req.auth = verificarToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Token invalido o caducado" });
  }
}
