import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app";
import { conectarMongo, desconectarMongo } from "../src/config/db";
import { User } from "../src/models/auth";
import { Modelos } from "../src/models/sync";

const app = crearApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await conectarMongo(mongod.getUri());
});

afterAll(async () => {
  await desconectarMongo();
  await mongod.stop();
});

beforeEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) {
    await c.deleteMany({});
  }
});

/** Enlace mágico + verify → token JWT (con el rol que tenga el usuario). */
async function tokenPara(email: string): Promise<string> {
  const ml = await request(app).post("/auth/magic-link").send({ email });
  const magico = String(ml.body.enlace).split("token=")[1];
  const v = await request(app).post("/auth/verify").send({ token: magico });
  return v.body.token as string;
}

async function orgDe(email: string): Promise<string> {
  const u = await User.findOne({ email }).lean();
  return u!.organizationId;
}

/** Id de la cuadrilla que `verify` crea para la organización. */
async function crewIdDe(orgId: string): Promise<string> {
  const c = await Modelos.crew.findOne({ organizationId: orgId }).lean();
  return c!._id;
}

function opWorker(orgId: string, id: string, extra: Record<string, unknown> = {}) {
  return {
    entity: "worker",
    entityId: id,
    op: "upsert" as const,
    updatedAt: 1000,
    payload: {
      id,
      organizationId: orgId,
      name: `W-${id}`,
      alias: id.toUpperCase(),
      crewId: "c1",
      language: "es",
      activo: 1,
      updatedAt: 1000,
      deleted: 0,
      ...extra,
    },
  };
}

async function sync(token: string, ops: unknown[]): Promise<void> {
  await request(app)
    .post("/sync")
    .set("authorization", `Bearer ${token}`)
    .send({ lastSyncAt: null, ops });
}

describe("/admin", () => {
  it("sin token responde 401", async () => {
    const r = await request(app).get("/admin/resumen");
    expect(r.status).toBe(401);
  });

  it("un foreman no puede entrar (403)", async () => {
    await tokenPara("jefe@empresa.com"); // alta inicial (owner)
    await User.updateOne(
      { email: "jefe@empresa.com" },
      { $set: { role: "foreman" } },
    );
    const token = await tokenPara("jefe@empresa.com"); // token nuevo, ya foreman

    const r = await request(app)
      .get("/admin/resumen")
      .set("authorization", `Bearer ${token}`);
    expect(r.status).toBe(403);
  });

  it("el owner ve el resumen y sus datos", async () => {
    const token = await tokenPara("gestor@empresa.com");
    const orgId = await orgDe("gestor@empresa.com");
    const crewId = await crewIdDe(orgId);
    await sync(token, [
      opWorker(orgId, "w1", { crewId }),
      opWorker(orgId, "w2", { crewId }),
    ]);

    const resumen = await request(app)
      .get("/admin/resumen")
      .set("authorization", `Bearer ${token}`);
    expect(resumen.status).toBe(200);
    expect(resumen.body.cuadrillas).toBe(1); // verify crea 1
    expect(resumen.body.trabajadoresActivos).toBe(2);

    const trabajadores = await request(app)
      .get("/admin/trabajadores")
      .set("authorization", `Bearer ${token}`);
    expect(
      trabajadores.body.map((w: { id: string }) => w.id).sort(),
    ).toEqual(["w1", "w2"]);
    expect(trabajadores.body[0].cuadrilla).toBeTruthy();

    const cuadrillas = await request(app)
      .get("/admin/cuadrillas")
      .set("authorization", `Bearer ${token}`);
    expect(cuadrillas.body).toHaveLength(1);
    expect(cuadrillas.body[0].numTrabajadores).toBe(2);
  });

  it("filtra trabajadores por texto", async () => {
    const token = await tokenPara("g2@empresa.com");
    const orgId = await orgDe("g2@empresa.com");
    await sync(token, [
      opWorker(orgId, "w1", { name: "Ana Ruiz" }),
      opWorker(orgId, "w2", { name: "Beto Sanz" }),
    ]);

    const r = await request(app)
      .get("/admin/trabajadores?q=ana")
      .set("authorization", `Bearer ${token}`);
    expect(r.body.map((w: { name: string }) => w.name)).toEqual(["Ana Ruiz"]);
  });
});
