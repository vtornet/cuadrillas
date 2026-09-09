import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requiereAuth, requiereRol } from "../middleware/auth";
import * as admin from "../services/adminService";

/**
 * Panel de empresa. Solo lectura por ahora (Fase B): resumen, cuadrillas,
 * trabajadores y partes. Todo gated a `owner` / `gestor`.
 */
export const adminRouter = Router();

adminRouter.use(requiereAuth, requiereRol("owner", "gestor"));

/** Envuelve un handler async y responde 404 si devuelve `null`. */
function h(
  fn: (req: Request) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req)
      .then((data) => {
        if (data === null) {
          res.status(404).json({ error: "No encontrado" });
          return;
        }
        res.json(data);
      })
      .catch(next);
  };
}

const q = (req: Request, nombre: string): string | undefined => {
  const v = req.query[nombre];
  return typeof v === "string" && v.length > 0 ? v : undefined;
};

adminRouter.get(
  "/resumen",
  h((req) => admin.resumen(req.auth!.organizationId)),
);

adminRouter.get(
  "/cuadrillas",
  h((req) => admin.cuadrillas(req.auth!.organizationId)),
);

adminRouter.get(
  "/trabajadores",
  h((req) =>
    admin.trabajadores(req.auth!.organizationId, {
      crewId: q(req, "crewId"),
      q: q(req, "q"),
    }),
  ),
);

adminRouter.get(
  "/trabajadores/:id",
  h((req) => admin.trabajador(req.auth!.organizationId, req.params.id)),
);

adminRouter.get(
  "/partes",
  h((req) =>
    admin.partes(req.auth!.organizationId, {
      crewId: q(req, "crewId"),
      desde: q(req, "desde"),
      hasta: q(req, "hasta"),
    }),
  ),
);

adminRouter.get(
  "/partes/:id",
  h((req) => admin.parte(req.auth!.organizationId, req.params.id)),
);

// ── Catálogos ──────────────────────────────────────────────────────────────

adminRouter.get(
  "/productos",
  h((req) => admin.productos(req.auth!.organizationId)),
);
adminRouter.get(
  "/unidades",
  h((req) => admin.unidades(req.auth!.organizationId)),
);

// ── Tarifas (CRUD) ─────────────────────────────────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const tarifaSchema = z.object({
  productId: z.string().min(1),
  unitTypeId: z.string().min(1),
  amountPerUnit: z.number().int().nonnegative(),
  validFrom: z.string().regex(ISO),
  validTo: z.string().regex(ISO).nullable(),
});

adminRouter.get(
  "/tarifas",
  h((req) => admin.tarifas(req.auth!.organizationId)),
);

adminRouter.post("/tarifas", (req, res, next) => {
  const datos = tarifaSchema.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: "Datos de tarifa inválidos" });
    return;
  }
  admin
    .crearTarifa(req.auth!.organizationId, datos.data)
    .then((r) => res.status(201).json(r))
    .catch(next);
});

adminRouter.put("/tarifas/:id", (req, res, next) => {
  const datos = tarifaSchema.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: "Datos de tarifa inválidos" });
    return;
  }
  admin
    .actualizarTarifa(req.auth!.organizationId, req.params.id, datos.data)
    .then((r) => {
      if (!r) {
        res.status(404).json({ error: "Tarifa no encontrada" });
        return;
      }
      res.json(r);
    })
    .catch(next);
});

adminRouter.delete("/tarifas/:id", (req, res, next) => {
  admin
    .borrarTarifa(req.auth!.organizationId, req.params.id)
    .then((ok) => {
      if (!ok) {
        res.status(404).json({ error: "Tarifa no encontrada" });
        return;
      }
      res.json({ ok: true });
    })
    .catch(next);
});

// ── Asistencia y liquidación ───────────────────────────────────────────────

adminRouter.get("/asistencia", (req, res, next) => {
  const anio = Number(q(req, "anio"));
  const mes = Number(q(req, "mes"));
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    res.status(400).json({ error: "Parámetros anio/mes inválidos" });
    return;
  }
  admin
    .asistencia(req.auth!.organizationId, { anio, mes, crewId: q(req, "crewId") })
    .then((data) => res.json(data))
    .catch(next);
});

adminRouter.get("/liquidacion", (req, res, next) => {
  const desde = q(req, "desde");
  const hasta = q(req, "hasta");
  if (!desde || !hasta || !ISO.test(desde) || !ISO.test(hasta)) {
    res.status(400).json({ error: "Parámetros desde/hasta inválidos" });
    return;
  }
  admin
    .liquidacion(req.auth!.organizationId, {
      desde,
      hasta,
      crewId: q(req, "crewId"),
    })
    .then((data) => res.json(data))
    .catch(next);
});
