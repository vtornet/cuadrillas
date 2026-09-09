import type { NextFunction, Request, Response } from "express";
import type { Rol } from "@cuadrilla/shared";
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

/**
 * Exige que el usuario autenticado tenga uno de los roles dados. Se encadena
 * después de `requiereAuth`. Para el panel de empresa (`/admin`).
 */
export function requiereRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Falta el token" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: "Sin permiso para esta operacion" });
      return;
    }
    next();
  };
}
