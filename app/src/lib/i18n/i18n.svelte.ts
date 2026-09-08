import type { Idioma } from "@cuadrilla/shared";
import { IDIOMAS } from "@cuadrilla/shared";
import es from "./locales/es.json";
import en from "./locales/en.json";
import ro from "./locales/ro.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";
import { getMeta, setMeta } from "../db/meta";

/** El idioma de la interfaz coincide con `Idioma` (es/en/ro/ar/fr). */
export type Locale = Idioma;

type Dict = Record<string, unknown>;

const DICCIONARIOS: Record<Locale, Dict> = { es, en, ro, ar, fr };

const META_LOCALE = "locale";

/** Nombre nativo de cada idioma, para el selector. */
export const NOMBRE_IDIOMA: Record<Locale, string> = {
  es: "Español",
  en: "English",
  ro: "Română",
  ar: "العربية",
  fr: "Français",
};

/** Idiomas que se escriben de derecha a izquierda. */
const RTL: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

function esLocale(v: string): v is Locale {
  return (IDIOMAS as readonly string[]).includes(v);
}

/**
 * i18n mínima. `es` es el fallback: cualquier clave que falte en otro idioma
 * se resuelve en español. El idioma elegido se guarda en `meta`.
 */
class I18n {
  locale = $state<Locale>("es");

  get rtl(): boolean {
    return RTL.has(this.locale);
  }

  /** Carga el idioma guardado; si no hay, lo deduce del navegador. */
  async cargar(): Promise<void> {
    const guardado = await getMeta<string>(META_LOCALE);
    if (guardado && esLocale(guardado)) {
      this.#aplicar(guardado);
      return;
    }
    const nav =
      typeof navigator !== "undefined"
        ? navigator.language.slice(0, 2).toLowerCase()
        : "es";
    this.#aplicar(esLocale(nav) ? nav : "es");
  }

  async cambiar(locale: Locale): Promise<void> {
    this.#aplicar(locale);
    await setMeta(META_LOCALE, locale);
  }

  #aplicar(locale: Locale): void {
    this.locale = locale;
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = RTL.has(locale) ? "rtl" : "ltr";
    }
  }

  t(key: string, vars?: Record<string, string | number>): string {
    const valor =
      this.buscar(DICCIONARIOS[this.locale], key) ??
      this.buscar(DICCIONARIOS.es, key);

    if (typeof valor !== "string") return key;
    if (!vars) return valor;

    return valor.replace(/\{(\w+)\}/g, (_, k: string) =>
      k in vars ? String(vars[k]) : `{${k}}`,
    );
  }

  private buscar(dict: Dict, key: string): unknown {
    return key
      .split(".")
      .reduce<unknown>(
        (obj, k) => (obj as Dict | undefined)?.[k],
        dict as unknown,
      );
  }
}

export const i18n = new I18n();
