import { Router } from "express";
import { z } from "zod";
import type { PendingOp } from "@cuadrilla/shared";
import { requiereAuth } from "../middleware/auth";
import { procesarSync } from "../services/syncService";

export const syncRouter = Router();

const opSchema = z.object({
  entity: z.string(),
  entityId: z.string(),
  op: z.enum(["upsert", "delete"]),
  payload: z.unknown(),
  updatedAt: z.number(),
  createdAt: z.number().optional(),
});

const bodySchema = z.object({
  lastSyncAt: z.string().nullable(),
  ops: z.array(opSchema).max(5000),
});

syncRouter.post("/", requiereAuth, async (req, res, next) => {
  try {
    const { lastSyncAt, ops } = bodySchema.parse(req.body);
    const resultado = await procesarSync(
      { organizationId: req.auth!.organizationId },
      lastSyncAt,
      ops as PendingOp[],
    );
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});
