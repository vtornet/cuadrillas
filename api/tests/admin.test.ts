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

/** Id de una cuadrilla de la organización (opcionalmente distinta de `excepto`). */
async function crewIdDe(orgId: string, excepto?: string): Promise<string> {
  const filtro: Record<string, unknown> = { organizationId: orgId };
  if (excepto) filtro._id = { $ne: excepto };
  const c = await Modelos.crew.findOne(filtro).lean();
  return c!._id;
}

/** `extra` debe traer un `crewId` real (de `crewIdDe`) — el push de /sync
 * exige que sea una cuadrilla del jefe que sincroniza (ver `syncService`). */
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
    const crewId = await crewIdDe(orgId);
    await sync(token, [
      opWorker(orgId, "w1", { crewId, name: "Ana Ruiz" }),
      opWorker(orgId, "w2", { crewId, name: "Beto Sanz" }),
    ]);

    const r = await request(app)
      .get("/admin/trabajadores?q=ana")
      .set("authorization", `Bearer ${token}`);
    expect(r.body.map((w: { name: string }) => w.name)).toEqual(["Ana Ruiz"]);
  });

  it("CRUD de cuadrillas desde el panel", async () => {
    const token = await tokenPara("gc@empresa.com");
    const orgId = await orgDe("gc@empresa.com");
    const auth = { authorization: `Bearer ${token}` };
    await Modelos.organization.updateOne(
      { _id: orgId },
      { $set: { "planLimits.crews": 25 } },
    );

    const c = await request(app)
      .post("/admin/cuadrillas")
      .set(auth)
      .send({ name: "  Cuadrilla Sur  " });
    expect(c.status).toBe(201);
    const id = c.body.id as string;

    const lista = await request(app).get("/admin/cuadrillas").set(auth);
    expect(lista.body.map((x: { name: string }) => x.name)).toContain(
      "Cuadrilla Sur",
    );

    const ren = await request(app)
      .put(`/admin/cuadrillas/${id}`)
      .set(auth)
      .send({ name: "Cuadrilla Este" });
    expect(ren.body.name).toBe("Cuadrilla Este");

    // Un trabajador de OTRA cuadrilla no debe bloquear el borrado (el conteo
    // tiene que filtrar por crewId de verdad, no contar toda la org).
    await Modelos.worker.create({
      _id: "w-otra",
      organizationId: orgId,
      crewId: await crewIdDe(orgId, id),
      name: "Beto",
      updatedAt: 1,
      serverUpdatedAt: new Date(),
      deleted: false,
    });

    // Con un trabajador DENTRO sí bloquea.
    await Modelos.worker.create({
      _id: "w1",
      organizationId: orgId,
      crewId: id,
      name: "Ana",
      updatedAt: 1,
      serverUpdatedAt: new Date(),
      deleted: false,
    });
    const bloqueado = await request(app)
      .delete(`/admin/cuadrillas/${id}`)
      .set(auth);
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error).toContain("1 trabajador"); // no 2

    // Sin trabajadores, se borra.
    await Modelos.worker.deleteOne({ _id: "w1" });
    const borrado = await request(app)
      .delete(`/admin/cuadrillas/${id}`)
      .set(auth);
    expect(borrado.body.ok).toBe(true);
    const tras = await request(app).get("/admin/cuadrillas").set(auth);
    expect(tras.body.map((x: { name: string }) => x.name)).not.toContain(
      "Cuadrilla Este",
    );
  });

  it("asignar una cuadrilla nueva a un jefe le hace ver su historial anterior", async () => {
    const token = await tokenPara("refresco@empresa.com");
    const orgId = await orgDe("refresco@empresa.com");
    const auth = { authorization: `Bearer ${token}` };
    const me = await User.findOne({ email: "refresco@empresa.com" }).lean();
    await Modelos.organization.updateOne(
      { _id: orgId },
      { $set: { "planLimits.crews": 25 } },
    );

    // Segunda cuadrilla con historial YA existente (anterior a que este jefe
    // la lidere): un trabajador con serverUpdatedAt antiguo.
    const c2 = await request(app)
      .post("/admin/cuadrillas")
      .set(auth)
      .send({ name: "Segunda" });
    const crew2 = c2.body.id as string;
    await Modelos.worker.create({
      _id: "w-historico",
      organizationId: orgId,
      crewId: crew2,
      name: "Ana",
      updatedAt: 1,
      serverUpdatedAt: new Date("2020-01-01"),
      deleted: false,
    });

    // El jefe ya sincronizó antes de que le asignaran la cuadrilla 2 (cursor
    // avanzado) — sin "refrescar", el pull por fecha se saltaría ese historial.
    const primera = await request(app)
      .post("/sync")
      .set(auth)
      .send({ lastSyncAt: null, ops: [] });
    const cursor = primera.body.serverTime as string;
    let cambios = (
      await request(app)
        .post("/sync")
        .set(auth)
        .send({ lastSyncAt: cursor, ops: [] })
    ).body.changes;
    expect(cambios.worker ?? []).toHaveLength(0);

    await request(app)
      .put(`/admin/jefes/${me!._id}/cuadrillas`)
      .set(auth)
      .send({ crewIds: [crew2] });

    cambios = (
      await request(app)
        .post("/sync")
        .set(auth)
        .send({ lastSyncAt: cursor, ops: [] })
    ).body.changes;
    expect((cambios.worker ?? []).map((w: { id: string }) => w.id)).toContain(
      "w-historico",
    );
  });

  it("no deja crear cuadrillas por encima del límite del plan", async () => {
    const token = await tokenPara("gc2@empresa.com");
    const auth = { authorization: `Bearer ${token}` };
    // Plan free: 2 cuadrillas. verify ya crea 1.
    const ok = await request(app)
      .post("/admin/cuadrillas")
      .set(auth)
      .send({ name: "Segunda" });
    expect(ok.status).toBe(201);
    const no = await request(app)
      .post("/admin/cuadrillas")
      .set(auth)
      .send({ name: "Tercera" });
    expect(no.status).toBe(409);
    expect(no.body.error).toMatch(/plan/i);
  });

  it("edita los datos laborales de un trabajador (alta)", async () => {
    const token = await tokenPara("altas@empresa.com");
    const orgId = await orgDe("altas@empresa.com");
    const crewId = await crewIdDe(orgId);
    const auth = { authorization: `Bearer ${token}` };
    await sync(token, [opWorker(orgId, "w1", { crewId, name: "Ana" })]);

    const r = await request(app)
      .put("/admin/trabajadores/w1/laboral")
      .set(auth)
      .send({
        dni: "  12345678Z ",
        iban: "ES91 2100 0418 4502 0005 1332",
        fechaAlta: "2026-01-15",
      });
    expect(r.status).toBe(200);
    expect(r.body.laboral.dni).toBe("12345678Z"); // recortado

    const ficha = await request(app)
      .get("/admin/trabajadores/w1")
      .set(auth);
    expect(ficha.body.laboral.fechaAlta).toBe("2026-01-15");

    // Campo no permitido → 400
    const mal = await request(app)
      .put("/admin/trabajadores/w1/laboral")
      .set(auth)
      .send({ sueldo: 1000 });
    expect(mal.status).toBe(400);

    // Vaciar todo → laboral desaparece
    await request(app)
      .put("/admin/trabajadores/w1/laboral")
      .set(auth)
      .send({ dni: "", iban: "" });
    const vacia = await request(app)
      .get("/admin/trabajadores/w1")
      .set(auth);
    expect(vacia.body.laboral).toBeUndefined();

    // Trabajador inexistente → 404
    const noExiste = await request(app)
      .put("/admin/trabajadores/zzz/laboral")
      .set(auth)
      .send({ dni: "X" });
    expect(noExiste.status).toBe(404);
  });

  it("el detalle de un parte solo trae SUS anotaciones, y /partes filtra por cuadrilla", async () => {
    const token = await tokenPara("partes@empresa.com");
    const orgId = await orgDe("partes@empresa.com");
    const crew1 = await crewIdDe(orgId);
    const auth = { authorization: `Bearer ${token}` };
    await Modelos.organization.updateOne(
      { _id: orgId },
      { $set: { "planLimits.crews": 25 } },
    );
    const c2 = await request(app)
      .post("/admin/cuadrillas")
      .set(auth)
      .send({ name: "Cuadrilla B" });
    const crew2 = c2.body.id as string;

    const shift = (crewId: string, id: string) => ({
      _id: id,
      organizationId: orgId,
      crewId,
      fecha: "2026-03-10",
      horaInicio: "08:00",
      horaFin: "14:00",
      productId: "p1",
      unitTypeId: "u1",
      estado: "closed",
      attendeeIds: [],
      updatedAt: 1,
      serverUpdatedAt: new Date(),
      deleted: false,
    });
    await Modelos.shift.create(shift(crew1, "s1"));
    await Modelos.shift.create(shift(crew2, "s2"));
    await Modelos.entry.create({
      _id: "e1",
      organizationId: orgId,
      shiftId: "s1",
      cantidad: 10,
      timestamp: 1,
      registradoPor: "u1",
      updatedAt: 1,
      serverUpdatedAt: new Date(),
      deleted: false,
    });
    await Modelos.entry.create({
      _id: "e2",
      organizationId: orgId,
      shiftId: "s2",
      cantidad: 99,
      timestamp: 1,
      registradoPor: "u1",
      updatedAt: 1,
      serverUpdatedAt: new Date(),
      deleted: false,
    });

    const detalle = await request(app).get("/admin/partes/s1").set(auth);
    expect(detalle.body.entries.map((e: { id: string }) => e.id)).toEqual(["e1"]);

    const soloCrew2 = await request(app)
      .get(`/admin/partes?crewId=${crew2}`)
      .set(auth);
    expect(soloCrew2.body.map((s: { id: string }) => s.id)).toEqual(["s2"]);
  });

  it("CRUD de tarifas", async () => {
    const token = await tokenPara("tarifas@empresa.com");
    const auth = { authorization: `Bearer ${token}` };
    const tarifa = {
      productId: "p1",
      unitTypeId: "u1",
      amountPerUnit: 18,
      validFrom: "2026-01-01",
      validTo: null,
    };

    const creada = await request(app)
      .post("/admin/tarifas")
      .set(auth)
      .send(tarifa);
    expect(creada.status).toBe(201);
    const id = creada.body.id as string;

    const lista = await request(app).get("/admin/tarifas").set(auth);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].amountPerUnit).toBe(18);

    const upd = await request(app)
      .put(`/admin/tarifas/${id}`)
      .set(auth)
      .send({ ...tarifa, amountPerUnit: 20 });
    expect(upd.body.amountPerUnit).toBe(20);

    const borrado = await request(app)
      .delete(`/admin/tarifas/${id}`)
      .set(auth);
    expect(borrado.body.ok).toBe(true);
    const tras = await request(app).get("/admin/tarifas").set(auth);
    expect(tras.body).toHaveLength(0);

    const mal = await request(app)
      .post("/admin/tarifas")
      .set(auth)
      .send({ ...tarifa, amountPerUnit: -1 });
    expect(mal.status).toBe(400);
  });

  it("invitar un jefe: gate de plan, aceptación y asignación de cuadrilla", async () => {
    const token = await tokenPara("empresa@x.com");
    const orgId = await orgDe("empresa@x.com");
    const crewId = await crewIdDe(orgId);
    const auth = { authorization: `Bearer ${token}` };

    // Plan gratis (foremen: 1) → no se puede invitar.
    const bloqueada = await request(app)
      .post("/admin/invitaciones")
      .set(auth)
      .send({ email: "jefe2@x.com", crewIds: [crewId] });
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.error).toMatch(/plan/i);

    // Subimos el límite (lo haría el webhook de Stripe al pasar a "company").
    await Modelos.organization.updateOne(
      { _id: orgId },
      { $set: { "planLimits.foremen": 25 } },
    );

    const inv = await request(app)
      .post("/admin/invitaciones")
      .set(auth)
      .send({ email: "jefe2@x.com", crewIds: [crewId] });
    expect(inv.status).toBe(201);
    const magico = String(inv.body.enlace).split("token=")[1];

    // Pendiente en /equipo.
    const eq1 = await request(app).get("/admin/equipo").set(auth);
    expect(eq1.body.invitaciones.map((i: { email: string }) => i.email)).toEqual([
      "jefe2@x.com",
    ]);

    // El jefe acepta: se une a la MISMA org como foreman, en la cuadrilla.
    const v = await request(app).post("/auth/verify").send({ token: magico });
    expect(v.body.user.role).toBe("foreman");
    expect(v.body.user.organizationId).toBe(orgId);

    const eq2 = await request(app).get("/admin/equipo").set(auth);
    expect(eq2.body.invitaciones).toHaveLength(0);
    const jefe = eq2.body.jefes.find(
      (j: { email: string }) => j.email === "jefe2@x.com",
    );
    expect(jefe.cuadrillas.map((c: { id: string }) => c.id)).toEqual([crewId]);

    // Reasignar: quitarle la cuadrilla.
    await request(app)
      .put(`/admin/jefes/${jefe.id}/cuadrillas`)
      .set(auth)
      .send({ crewIds: [] });
    const eq3 = await request(app).get("/admin/equipo").set(auth);
    expect(
      eq3.body.jefes.find((j: { email: string }) => j.email === "jefe2@x.com")
        .cuadrillas,
    ).toEqual([]);
  });

  it("revocar una invitación pendiente", async () => {
    const token = await tokenPara("empresa2@x.com");
    const orgId = await orgDe("empresa2@x.com");
    const auth = { authorization: `Bearer ${token}` };
    await Modelos.organization.updateOne(
      { _id: orgId },
      { $set: { "planLimits.foremen": 25 } },
    );

    const inv = await request(app)
      .post("/admin/invitaciones")
      .set(auth)
      .send({ email: "otro@x.com" });
    const t = inv.body.token as string;

    const del = await request(app)
      .delete(`/admin/invitaciones/${t}`)
      .set(auth);
    expect(del.body.ok).toBe(true);

    const eq = await request(app).get("/admin/equipo").set(auth);
    expect(eq.body.invitaciones).toHaveLength(0);
  });

  it("liquidación de un periodo con tarifa", async () => {
    const token = await tokenPara("liq@empresa.com");
    const orgId = await orgDe("liq@empresa.com");
    const crewId = await crewIdDe(orgId);
    const auth = { authorization: `Bearer ${token}` };

    await sync(token, [
      opWorker(orgId, "w1", { crewId, name: "Ana" }),
      {
        entity: "shift",
        entityId: "s1",
        op: "upsert" as const,
        updatedAt: 1000,
        payload: {
          id: "s1",
          organizationId: orgId,
          crewId,
          fecha: "2026-03-10",
          horaInicio: "08:00",
          horaFin: "14:00",
          productId: "p1",
          unitTypeId: "u1",
          estado: "closed",
          attendeeIds: ["w1"],
          updatedAt: 1000,
          deleted: 0,
        },
      },
      {
        entity: "entry",
        entityId: "e1",
        op: "upsert" as const,
        updatedAt: 1000,
        payload: {
          id: "e1",
          organizationId: orgId,
          shiftId: "s1",
          workerId: "w1",
          cantidad: 100,
          timestamp: 1000,
          registradoPor: "u1",
          updatedAt: 1000,
          deleted: 0,
        },
      },
    ]);

    await request(app)
      .post("/admin/tarifas")
      .set(auth)
      .send({
        productId: "p1",
        unitTypeId: "u1",
        amountPerUnit: 18,
        validFrom: "2026-01-01",
        validTo: null,
      });

    const r = await request(app)
      .get("/admin/liquidacion?desde=2026-03-01&hasta=2026-03-31")
      .set(auth);
    expect(r.status).toBe(200);
    expect(r.body.destajoCentimos).toBe(1800); // 100 × 18
    expect(r.body.trabajadores[0].name).toBe("Ana");

    const sinFechas = await request(app).get("/admin/liquidacion").set(auth);
    expect(sinFechas.status).toBe(400);
  });
});
