export type Vista =
  | "registro"
  | "jornada"
  | "estadisticas"
  | "liquidacion"
  | "gestion"
  | "cuenta";

const VISTAS: Vista[] = [
  "registro",
  "jornada",
  "estadisticas",
  "liquidacion",
  "gestion",
  "cuenta",
];

/**
 * Enrutado minimo por hash (`#/registro`, `#/jornada`). Suficiente para el MVP;
 * sin dependencias. La pantalla principal es "registro".
 */
class Router {
  vista = $state<Vista>("registro");
  menuAbierto = $state(false);

  constructor() {
    if (typeof window === "undefined") return;
    this.#leerHash();
    window.addEventListener("hashchange", () => this.#leerHash());
  }

  ir(v: Vista): void {
    this.vista = v;
    this.menuAbierto = false;
    if (typeof window !== "undefined") {
      const nuevo = `#/${v}`;
      if (window.location.hash !== nuevo) window.location.hash = nuevo;
    }
  }

  abrirMenu(): void {
    this.menuAbierto = true;
  }

  cerrarMenu(): void {
    this.menuAbierto = false;
  }

  #leerHash(): void {
    const h = window.location.hash
      .replace(/^#\/?/, "")
      .split("?")[0] as Vista;
    if (VISTAS.includes(h)) this.vista = h;
  }
}

export const router = new Router();
