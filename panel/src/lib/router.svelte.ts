/** Router por hash muy simple: `#/trabajadores`, `#/partes/<id>`… */
export type Vista =
  | "resumen"
  | "cuadrillas"
  | "trabajadores"
  | "partes"
  | "asistencia"
  | "altas"
  | "tarifas"
  | "liquidacion"
  | "equipo";

export const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "cuadrillas", etiqueta: "Cuadrillas" },
  { id: "trabajadores", etiqueta: "Trabajadores" },
  { id: "altas", etiqueta: "Altas" },
  { id: "partes", etiqueta: "Partes" },
  { id: "asistencia", etiqueta: "Asistencia" },
  { id: "tarifas", etiqueta: "Tarifas" },
  { id: "liquidacion", etiqueta: "Liquidación" },
  { id: "equipo", etiqueta: "Equipo" },
];

function segmentos(): string[] {
  if (typeof location === "undefined") return [];
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

class Router {
  vista = $state<Vista>("resumen");
  /** Segundo segmento de la ruta (p. ej. id de parte o de trabajador). */
  param = $state<string | null>(null);

  constructor() {
    if (typeof window === "undefined") return;
    this.#leer();
    window.addEventListener("hashchange", () => this.#leer());
  }

  ir(vista: Vista, param?: string): void {
    location.hash = `#/${vista}${param ? `/${param}` : ""}`;
  }

  #leer(): void {
    const [v, p] = segmentos();
    const valida = VISTAS.some((x) => x.id === v);
    this.vista = (valida ? v : "resumen") as Vista;
    this.param = p ?? null;
  }
}

export const router = new Router();
