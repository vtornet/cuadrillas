import { describe, expect, it } from "vitest";
import {
  aliasAnonimo,
  anonimizarWorker,
  informeTrabajador,
  type ResolutoresNombre,
} from "../src/domain/rgpd";
import type { Entry } from "../src/types/entry";
import type { Shift } from "../src/types/shift";
import type { Worker } from "../src/types/worker";

function worker(p: Partial<Worker> = {}): Worker {
  return {
    id: "w1",
    organizationId: "o",
    name: "Juan Pérez",
    alias: "JUAN",
    crewId: "c1",
    language: "es",
    activo: 1,
    qrCode: "JUAN",
    transporteCentimos: 500,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function shift(p: Partial<Shift>): Shift {
  return {
    id: "s1",
    organizationId: "o",
    crewId: "c1",
    fecha: "2026-09-01",
    horaInicio: "08:00",
    horaFin: "16:00",
    productId: "p1",
    unitTypeId: "u1",
    estado: "closed",
    attendeeIds: ["w1"],
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

function entry(p: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    organizationId: "o",
    shiftId: "s1",
    workerId: "w1",
    cantidad: 1,
    timestamp: 1,
    registradoPor: "u1",
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

const nombres: ResolutoresNombre = {
  crew: (id) => ({ c1: "Cuadrilla 1", c2: "Cuadrilla 2" })[id] ?? id,
  producto: (id) => ({ p1: "Naranja" })[id] ?? id,
  unidad: (id) => ({ u1: "Caja" })[id] ?? id,
};

describe("informeTrabajador", () => {
  it("incluye la ficha y un día por parte con asistencia o anotaciones", () => {
    const shifts = [
      shift({ id: "s1", fecha: "2026-09-01", attendeeIds: ["w1", "w2"] }),
      shift({ id: "s2", fecha: "2026-09-02", attendeeIds: ["w2"] }), // no está
      shift({ id: "s3", fecha: "2026-09-03", attendeeIds: ["w2"] }), // presente vía entry
    ];
    const entries = [
      entry({ shiftId: "s1", cantidad: 3 }),
      entry({ shiftId: "s1", cantidad: 2 }),
      entry({ shiftId: "s1", cantidad: 1, deleted: 1 }), // anulada: se ignora
      entry({ shiftId: "s3", cantidad: 4 }),
      entry({ shiftId: "s1", cantidad: 9, workerId: "w2" }), // de otro
    ];

    const inf = informeTrabajador(worker(), shifts, entries, nombres, new Date("2026-09-07T10:00:00Z"));

    expect(inf.worker).toMatchObject({
      name: "Juan Pérez",
      alias: "JUAN",
      cuadrilla: "Cuadrilla 1",
      idioma: "es",
      codigoQr: "JUAN",
      transporteCentimos: 500,
    });
    expect(inf.generadoEl).toBe("2026-09-07T10:00:00.000Z");
    expect(inf.dias.map((d) => d.fecha)).toEqual(["2026-09-01", "2026-09-03"]);
    expect(inf.dias[0]).toMatchObject({
      numAnotaciones: 2,
      totalUnidades: 5,
      presente: true,
      porGrupos: false,
    });
    expect(inf.dias[1]).toMatchObject({
      numAnotaciones: 1,
      totalUnidades: 4,
      presente: false,
    });
    expect(inf.totalDias).toBe(2);
    expect(inf.totalUnidades).toBe(9);
  });

  it("marca porGrupos y no cuenta unidades individuales en partes por grupos", () => {
    const shifts = [
      shift({
        id: "s1",
        attendeeIds: ["w1"],
        groups: [{ groupId: "g1", name: "A", memberIds: ["w1"] }],
      }),
    ];
    const inf = informeTrabajador(worker(), shifts, [], nombres);
    expect(inf.dias).toHaveLength(1);
    expect(inf.dias[0].porGrupos).toBe(true);
    expect(inf.dias[0].totalUnidades).toBe(0);
  });

  it("ignora partes borrados", () => {
    const shifts = [shift({ id: "s1", deleted: 1, attendeeIds: ["w1"] })];
    const inf = informeTrabajador(worker(), shifts, [], nombres);
    expect(inf.dias).toHaveLength(0);
  });
});

describe("anonimizarWorker", () => {
  it("borra los datos personales pero conserva el registro", () => {
    const w = worker({ id: "abc12345-def6-7890-abcd-ef1234567890" });
    const a = anonimizarWorker(w, "Trabajador eliminado");

    expect(a.id).toBe(w.id);
    expect(a.name).toBe("Trabajador eliminado");
    expect(a.alias).toBe(aliasAnonimo(w.id));
    expect(a.alias).toBe("ELIMINADO-ABC12345");
    expect(a.qrCode).toBeUndefined();
    expect(a.transporteCentimos).toBe(0);
    expect(a.language).toBe("es");
    expect(a.activo).toBe(0);
    expect(a.deleted).toBe(0);
    expect(a.crewId).toBe(w.crewId);
    expect(a.updatedAt).toBeGreaterThan(w.updatedAt);
  });
});
