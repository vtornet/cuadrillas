import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app";
import { conectarMongo, desconectarMongo } from "../src/config/db";
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
  const cols = mongoose.connection.collections;
  for (const nombre of Object.keys(cols)) {
    await cols[nombre].deleteMany({});
  }
});

async function login(email = "jefe@ejemplo.com") {
  const ml = await request(app).post("/auth/magic-link").send({ email });
  const token = String(ml.body.enlace).split("token=")[1];
  const v = await request(app).post("/auth/verify").send({ token });
  const data = v.body as { token: string; user: { organizationId: string } };
  // El pull de /sync es por cuadrilla: los tests de worker necesitan la
  // cuadrilla REAL del jefe (la que crea altaInicial), no una inventada.
  const crew = await Modelos.crew
    .findOne({ organizationId: data.user.organizationId })
    .lean<{ _id: string } | null>();
  return { ...data, crewId: crew!._id };
}

function opWorker(
  id: string,
  updatedAt: number,
  crewId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    entity: "worker",
    entityId: id,
    op: "upsert" as const,
    updatedAt,
    payload: {
      id,
      organizationId: "ajeno",
      name: `W-${id}`,
      alias: id.toUpperCase(),
      crewId,
      language: "es",
      activo: 1,
      updatedAt,
      deleted: 0,
      ...extra,
    },
  };
}

describe("/auth + /sync", () => {
  it("magic-link con destino=panel enlaza al panel", async () => {
    const app0 = await request(app)
      .post("/auth/magic-link")
      .send({ email: "x@ejemplo.com" });
    expect(String(app0.body.enlace)).toContain("localhost:5173");

    const panel = await request(app)
      .post("/auth/magic-link")
      .send({ email: "y@ejemplo.com", destino: "panel" });
    expect(String(panel.body.enlace)).toContain("localhost:5175");
  });

  it("verify crea organizacion, cuadrilla y usuario owner", async () => {
    const { token, user } = await login();
    expect(token).toBeTruthy();

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [] });

    expect(r.status).toBe(200);
    expect(r.body.changes.organization).toHaveLength(1);
    expect(r.body.changes.crew).toHaveLength(1);
    expect(r.body.changes.organization[0].id).toBe(user.organizationId);
    expect(r.body.changes.organization[0].deleted).toBe(0);
  });

  it("aplica upserts y fuerza el organizationId del token", async () => {
    const { token, user, crewId } = await login();
    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 1000, crewId)] });

    expect(r.body.applied).toContain("w1");
    const w = r.body.changes.worker[0];
    expect(w.name).toBe("W-w1");
    expect(w.organizationId).toBe(user.organizationId);
    expect(w.organizationId).not.toBe("ajeno");
  });

  it("LWW: una escritura mas antigua no pisa una mas reciente", async () => {
    const { token, crewId } = await login();
    await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 2000, crewId, { name: "NUEVO" })] });

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 1000, crewId, { name: "VIEJO" })] });

    const w = r.body.changes.worker.find((x: { id: string }) => x.id === "w1");
    expect(w.name).toBe("NUEVO");
    expect(r.body.applied).toContain("w1");
  });

  it("pull incremental: solo devuelve cambios posteriores a lastSyncAt", async () => {
    const { token, crewId } = await login();
    const primera = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 1000, crewId)] });

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: primera.body.serverTime, ops: [opWorker("w2", 2000, crewId)] });

    const ids = (r.body.changes.worker ?? []).map((x: { id: string }) => x.id);
    expect(ids).toContain("w2");
    expect(ids).not.toContain("w1");
  });

  it("rechaza el trabajador 11 en plan gratuito", async () => {
    const { token, crewId } = await login();
    const ops = Array.from({ length: 11 }, (_, i) => opWorker(`w${i + 1}`, 1000, crewId));

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops });

    expect(r.body.applied).toHaveLength(10);
    expect(r.body.rejected).toHaveLength(1);
    expect(r.body.rejected[0].reason).toMatch(/limite/i);
    expect(r.body.rejected[0].entity).toBe("worker");
  });

  it("el pull solo trae los trabajadores/partes de las cuadrillas del jefe", async () => {
    const { token, user, crewId } = await login();

    // Segunda cuadrilla de la MISMA organización, de la que este jefe no es
    // jefe (p. ej. creada desde el panel de empresa y asignada a otro).
    const otraCrew = "crew-otra";
    await Modelos.crew.create({
      _id: otraCrew,
      organizationId: user.organizationId,
      name: "Otra cuadrilla",
      foremanIds: ["otro-jefe"],
      updatedAt: 1,
      serverUpdatedAt: new Date(),
      deleted: false,
    });

    // El jefe empuja un trabajador a SU cuadrilla y (por error o malicia) uno
    // a la otra: el push no está restringido por cuadrilla, solo el pull.
    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({
        lastSyncAt: null,
        ops: [
          opWorker("w-mio", 1000, crewId),
          opWorker("w-ajeno", 1000, otraCrew),
        ],
      });

    const ids = (r.body.changes.worker ?? []).map((x: { id: string }) => x.id);
    expect(ids).toContain("w-mio");
    expect(ids).not.toContain("w-ajeno");
    // Tampoco ve la cuadrilla ajena en changes.crew.
    const crewIds = (r.body.changes.crew ?? []).map((x: { id: string }) => x.id);
    expect(crewIds).not.toContain(otraCrew);
  });

  it("/sync sin token responde 401", async () => {
    const r = await request(app).post("/sync").send({ lastSyncAt: null, ops: [] });
    expect(r.status).toBe(401);
  });
});
