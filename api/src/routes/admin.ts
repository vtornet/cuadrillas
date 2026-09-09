import { Router, type Request, type Response, type NextFunction } from "express";
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
