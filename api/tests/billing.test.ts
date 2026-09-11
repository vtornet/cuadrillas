import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app";
import { conectarMongo, desconectarMongo } from "../src/config/db";
import { Modelos } from "../src/models/sync";
import { procesarEventoStripe } from "../src/services/billingService";

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
  for (const nombre of Object.keys(cols)) await cols[nombre].deleteMany({});
});

async function login(email = "jefe@ejemplo.com") {
  const ml = await request(app).post("/auth/magic-link").send({ email });
  const token = String(ml.body.enlace).split("token=")[1];
  const v = await request(app).post("/auth/verify").send({ token });
  const data = v.body as { token: string; user: { organizationId: string } };
  // El push de /sync exige que el `crewId` sea de una cuadrilla del jefe.
  const crew = await Modelos.crew
    .findOne({ organizationId: data.user.organizationId })
    .lean<{ _id: string } | null>();
  return { ...data, crewId: crew!._id };
}

function evento(type: string, object: unknown): Stripe.Event {
  return { type, data: { object } } as unknown as Stripe.Event;
}

describe("billing", () => {
  it("checkout responde 503 si Stripe no esta configurado", async () => {
    const { token } = await login();
    const r = await request(app)
      .post("/billing/checkout")
      .set("authorization", `Bearer ${token}`)
      .send({ plan: "foreman" });
    expect(r.status).toBe(503);
  });

  it("checkout sin token responde 401", async () => {
    const r = await request(app).post("/billing/checkout").send({ plan: "foreman" });
    expect(r.status).toBe(401);
  });

  it("checkout.session.completed activa el plan y sube los limites", async () => {
    const { user } = await login();
    await procesarEventoStripe(
      evento("checkout.session.completed", {
        metadata: { organizationId: user.organizationId, plan: "company" },
        customer: "cus_123",
        subscription: "sub_123",
        mode: "subscription",
      }),
    );

    const org = await Modelos.organization.findById(user.organizationId).lean();
    expect(org?.plan).toBe("company");
    expect((org?.planLimits as { crews: number }).crews).toBeGreaterThan(1);
    expect(org?.stripeCustomerId).toBe("cus_123");
    expect(org?.stripeSubscriptionId).toBe("sub_123");
  });

  it("con plan de pago se puede pasar de 10 trabajadores en /sync", async () => {
    const { token, user, crewId } = await login();
    await procesarEventoStripe(
      evento("checkout.session.completed", {
        metadata: { organizationId: user.organizationId, plan: "company" },
        mode: "subscription",
      }),
    );

    const ops = Array.from({ length: 12 }, (_, i) => ({
      entity: "worker",
      entityId: `w${i}`,
      op: "upsert" as const,
      updatedAt: 1,
      payload: {
        id: `w${i}`,
        organizationId: "x",
        name: `W${i}`,
        alias: `W${i}`,
        crewId,
        activo: 1,
        updatedAt: 1,
        deleted: 0,
      },
    }));

    const r = await request(app)
      .post("/sync")
      .set("authorization", `Bearer ${token}`)
      .send({ lastSyncAt: null, ops });

    expect(r.body.rejected).toHaveLength(0);
    expect(r.body.applied).toHaveLength(12);
  });

  it("subscription.deleted vuelve al plan gratuito (limite 10)", async () => {
    const { user } = await login();
    await Modelos.organization.updateOne(
      { _id: user.organizationId },
      { $set: { stripeSubscriptionId: "sub_x", plan: "company" } },
    );

    await procesarEventoStripe(
      evento("customer.subscription.deleted", {
        id: "sub_x",
        status: "canceled",
        items: { data: [] },
      }),
    );

    const org = await Modelos.organization.findById(user.organizationId).lean();
    expect(org?.plan).toBe("free");
    expect((org?.planLimits as { workers: number }).workers).toBe(10);
  });
});
