import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app";
import { conectarMongo, desconectarMongo } from "../src/config/db";

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
  return v.body as { token: string; user: { organizationId: string } };
}

function opWorker(id: string, updatedAt: number, extra: Record<string, unknown> = {}) {
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
      crewId: "c1",
      language: "es",
      activo: 1,
      updatedAt,
      deleted: 0,
      ...extra,
    },
  };
}

describe("/auth + /sync", () => {
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
    const { token, user } = await login();
    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 1000)] });

    expect(r.body.applied).toContain("w1");
    const w = r.body.changes.worker[0];
    expect(w.name).toBe("W-w1");
    expect(w.organizationId).toBe(user.organizationId);
    expect(w.organizationId).not.toBe("ajeno");
  });

  it("LWW: una escritura mas antigua no pisa una mas reciente", async () => {
    const { token } = await login();
    await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 2000, { name: "NUEVO" })] });

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 1000, { name: "VIEJO" })] });

    const w = r.body.changes.worker.find((x: { id: string }) => x.id === "w1");
    expect(w.name).toBe("NUEVO");
    expect(r.body.applied).toContain("w1");
  });

  it("pull incremental: solo devuelve cambios posteriores a lastSyncAt", async () => {
    const { token } = await login();
    const primera = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops: [opWorker("w1", 1000)] });

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: primera.body.serverTime, ops: [opWorker("w2", 2000)] });

    const ids = (r.body.changes.worker ?? []).map((x: { id: string }) => x.id);
    expect(ids).toContain("w2");
    expect(ids).not.toContain("w1");
  });

  it("rechaza el trabajador 11 en plan gratuito", async () => {
    const { token } = await login();
    const ops = Array.from({ length: 11 }, (_, i) => opWorker(`w${i + 1}`, 1000));

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops });

    expect(r.body.applied).toHaveLength(10);
    expect(r.body.rejected).toHaveLength(1);
    expect(r.body.rejected[0].reason).toMatch(/limite/i);
    expect(r.body.rejected[0].entity).toBe("worker");
  });

  it("/sync sin token responde 401", async () => {
    const r = await request(app).post("/sync").send({ lastSyncAt: null, ops: [] });
    expect(r.status).toBe(401);
  });
});
