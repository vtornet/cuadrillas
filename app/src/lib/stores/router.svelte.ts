export type Vista =
  | "inicio"
  | "registro"
  | "historial"
  | "estadisticas"
  | "asistencia"
  | "gestion"
  | "cuenta"
  | "privacidad"
  | "ayuda";

const VISTAS: Vista[] = [
  "inicio",
  "registro",
  "historial",
  "estadisticas",
  "asistencia",
  "gestion",
  "cuenta",
  "privacidad",
  "ayuda",
];

/**
 * Enrutado minimo por hash (`#/registro`, `#/gestion`...). Suficiente para el
 * MVP; sin dependencias. La pantalla principal ("registro") es autosuficiente:
 * comenzar y finalizar la jornada se hacen ahi mismo, sin pantalla aparte. La
 * app sigue ABRIENDO en "registro" (no en "inicio") para no añadir un toque
 * extra a la acción mas repetida del día a día; "inicio" (el antiguo menú,
 * ahora pantalla propia con botones grandes) se alcanza desde el botón de
 * arriba a la izquierda en cualquier pantalla (`AppBar`).
 */
class Router {
  vista = $state<Vista>("registro");

  constructor() {
    if (typeof window === "undefined") return;
    this.#leerHash();
    window.addEventListener("hashchange", () => this.#leerHash());
  }

  ir(v: Vista): void {
    this.vista = v;
    if (typeof window !== "undefined") {
      const nuevo = `#/${v}`;
      if (window.location.hash !== nuevo) window.location.hash = nuevo;
    }
  }

  #leerHash(): void {
    const h = window.location.hash
      .replace(/^#\/?/, "")
      .split("?")[0] as Vista;
    if (VISTAS.includes(h)) this.vista = h;
  }
}

export const router = new Router();
