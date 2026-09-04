import es from "./locales/es.json";
import en from "./locales/en.json";

export type Locale = "es" | "en";

type Dict = Record<string, unknown>;

const DICCIONARIOS: Record<Locale, Dict> = { es, en };

/**
 * i18n minima. Estructura preparada para ro/ar/fr (interfaz del trabajador);
 * en el MVP solo se traducen es y en.
 */
class I18n {
  locale = $state<Locale>("es");

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
