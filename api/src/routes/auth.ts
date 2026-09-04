import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LIMITES_PLAN_GRATIS, type Rol } from "@cuadrilla/shared";
import { env } from "../config/env";
import { MagicToken, User } from "../models/auth";
import { Modelos } from "../models/sync";
import { enviarEnlaceMagico } from "../lib/email";
import { firmarToken } from "../lib/jwt";

export const authRouter = Router();

const emailSchema = z.object({ email: z.string().email() });
const tokenSchema = z.object({ token: z.string().min(1) });

authRouter.post("/magic-link", async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const token = randomUUID();
    await MagicToken.create({
      token,
      email: email.toLowerCase(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
    const enlace = `${env.appUrl}/#/entrar?token=${token}`;
    await enviarEnlaceMagico(email, enlace);
    // En desarrollo devolvemos el enlace para poder probar sin email.
    res.json({ ok: true, ...(env.isProd ? {} : { enlace }) });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/verify", async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body);
    const doc = await MagicToken.findOne({ token });
    if (!doc || doc.usedAt || doc.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "Enlace caducado o ya usado" });
      return;
    }
    doc.usedAt = new Date();
    await doc.save();

    let usuario: DatosUsuario | null = await User.findOne({ email: doc.email })
      .lean<DatosUsuario | null>();
    if (!usuario) {
      usuario = await altaInicial(doc.email);
    }

    res.json({
      token: firmarToken({
        userId: usuario._id,
        organizationId: usuario.organizationId,
        role: usuario.role,
      }),
      user: {
        id: usuario._id,
        email: usuario.email,
        role: usuario.role,
        organizationId: usuario.organizationId,
      },
    });
  } catch (e) {
    next(e);
  }
});

interface DatosUsuario {
  _id: string;
  email: string;
  role: Rol;
  organizationId: string;
}

/** Primer acceso de un email: crea organizacion + cuadrilla + usuario owner. */
async function altaInicial(email: string): Promise<DatosUsuario> {
  const orgId = randomUUID();
  const userId = randomUUID();
  const ahora = new Date();
  const ts = Date.now();

  await Modelos.organization.create({
    _id: orgId,
    organizationId: orgId,
    name: "Mi explotacion",
    plan: "free",
    planLimits: { ...LIMITES_PLAN_GRATIS },
    updatedAt: ts,
    serverUpdatedAt: ahora,
    deleted: false,
  });

  await Modelos.crew.create({
    _id: randomUUID(),
    organizationId: orgId,
    name: "Cuadrilla 1",
    foremanIds: [userId],
    updatedAt: ts,
    serverUpdatedAt: ahora,
    deleted: false,
  });

  await User.create({
    _id: userId,
    email,
    role: "owner",
    organizationId: orgId,
  });

  return { _id: userId, email, role: "owner", organizationId: orgId };
}
