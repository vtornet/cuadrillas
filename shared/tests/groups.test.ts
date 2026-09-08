import { describe, expect, it } from "vitest";
import { gruposPorTrabajador } from "../src/domain/groups";
import type { Group } from "../src/types/group";

function grupo(p: Partial<Group>): Group {
  return {
    id: crypto.randomUUID(),
    organizationId: "o",
    name: "G",
    crewId: "c1",
    memberIds: [],
    activo: 1,
    updatedAt: 1,
    deleted: 0,
    ...p,
  };
}

describe("gruposPorTrabajador", () => {
  it("mapea cada trabajador a su grupo activo", () => {
    const groups = [
      grupo({ id: "g1", name: "Grupo A", memberIds: ["w1", "w2"] }),
      grupo({ id: "g2", name: "Grupo B", memberIds: ["w3"] }),
    ];
    const m = gruposPorTrabajador(groups);
    expect(m.get("w1")).toBe("Grupo A");
    expect(m.get("w2")).toBe("Grupo A");
    expect(m.get("w3")).toBe("Grupo B");
    expect(m.has("w9")).toBe(false);
  });

  it("excluye el grupo que se está editando", () => {
    const groups = [
      grupo({ id: "g1", name: "Grupo A", memberIds: ["w1"] }),
      grupo({ id: "g2", name: "Grupo B", memberIds: ["w2"] }),
    ];
    const m = gruposPorTrabajador(groups, "g1");
    expect(m.has("w1")).toBe(false); // libre porque estoy editando g1
    expect(m.get("w2")).toBe("Grupo B");
  });

  it("ignora grupos inactivos y borrados", () => {
    const groups = [
      grupo({ id: "g1", name: "Inactivo", memberIds: ["w1"], activo: 0 }),
      grupo({ id: "g2", name: "Borrado", memberIds: ["w2"], deleted: 1 }),
      grupo({ id: "g3", name: "Activo", memberIds: ["w3"] }),
    ];
    const m = gruposPorTrabajador(groups);
    expect(m.has("w1")).toBe(false);
    expect(m.has("w2")).toBe(false);
    expect(m.get("w3")).toBe("Activo");
  });
});
