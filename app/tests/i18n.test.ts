import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/lib/db/dexie";
import { getMeta } from "../src/lib/db/meta";
import { i18n } from "../src/lib/i18n/i18n.svelte";

describe("i18n", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await i18n.cambiar("es");
  });

  it("traduce y sustituye variables", () => {
    expect(i18n.t("menu.registrar")).toBe("Iniciar parte");
    expect(i18n.t("cabecera.recolectores", { n: 3 })).toBe("3 recolector(es)");
  });

  it("cambia de idioma y persiste la elección", async () => {
    await i18n.cambiar("fr");
    expect(i18n.locale).toBe("fr");
    expect(i18n.t("menu.registrar")).toBe("Commencer la fiche");
    expect(await getMeta("locale")).toBe("fr");
  });

  it("cae al español si falta una clave en otro idioma", async () => {
    await i18n.cambiar("ro");
    // 'app.nombre' existe en ro como "Cuadrilla" fijo; usamos una inexistente
    expect(i18n.t("clave.que.no.existe")).toBe("clave.que.no.existe");
    // una real traducida
    expect(i18n.t("worker.guardar")).toBe("Salvează");
  });

  it("rtl solo es true en árabe", async () => {
    await i18n.cambiar("ar");
    expect(i18n.rtl).toBe(true);
    await i18n.cambiar("es");
    expect(i18n.rtl).toBe(false);
  });

  it("cargar lee el idioma guardado", async () => {
    await db.meta.put({ key: "locale", value: "fr" });
    await i18n.cargar();
    expect(i18n.locale).toBe("fr");
  });

  it("todos los idiomas tienen las mismas claves que es", async () => {
    const claves = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object"
          ? claves(v as Record<string, unknown>, `${p}${k}.`)
          : [`${p}${k}`],
      );
    const es = new Set(
      claves((await import("../src/lib/i18n/locales/es.json")).default),
    );
    for (const loc of ["en", "fr", "ro", "ar"]) {
      const d = (await import(`../src/lib/i18n/locales/${loc}.json`)).default;
      const k = new Set(claves(d));
      expect([...es].filter((x) => !k.has(x))).toEqual([]);
      expect([...k].filter((x) => !es.has(x))).toEqual([]);
    }
  });
});
