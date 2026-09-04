import jwt from "jsonwebtoken";
import type { Rol } from "@cuadrilla/shared";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  organizationId: string;
  role: Rol;
}

// Larga vida: el jefe hace login una vez y trabaja offline durante meses.
const CADUCIDAD = "365d";

export function firmarToken(p: TokenPayload): string {
  return jwt.sign(p, env.jwtSecret, { expiresIn: CADUCIDAD });
}

export function verificarToken(token: string): TokenPayload {
  const d = jwt.verify(token, env.jwtSecret);
  return d as TokenPayload;
}
