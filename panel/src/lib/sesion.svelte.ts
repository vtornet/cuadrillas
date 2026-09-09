import { API_URL } from "./config";

/**
 * Sesión del panel de empresa. Online puro: el token JWT vive en
 * `localStorage`, no hay modo demo ni sincronización. Solo entran `owner` y
 * `gestor`; un `foreman` que pruebe a entrar recibe un mensaje claro.
 */

interface Guardada {
  token: string;
  email: string;
  role: string;
  organizationId: string;
}

const CLAVE = "panel.sesion";
const ROLES_PANEL = ["owner", "gestor"];

class Sesion {
  estado = $state<"cargando" | "fuera" | "dentro">("cargando");
  email = $state<string | null>(null);
  role = $state("");
  organizationId = $state("");
  /** No reactivo: solo lo usa `api()`. */
  token: string | null = null;

  cargar(): void {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) {
        this.#aplicar(JSON.parse(raw) as Guardada);
        this.estado = "dentro";
        return;
      }
    } catch {
      /* localStorage no disponible */
    }
    this.estado = "fuera";
  }

  async pedirEnlace(email: string): Promise<{ enlace?: string }> {
    const r = await fetch(`${API_URL}/auth/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error("No se pudo enviar el enlace");
    return r.json();
  }

  /** Canjea el token del enlace mágico. Lanza si el rol no es de panel. */
  async verificar(tokenMagico: string): Promise<void> {
    const r = await fetch(`${API_URL}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: tokenMagico }),
    });
    if (!r.ok) throw new Error("Enlace caducado o inválido");
    const data = (await r.json()) as {
      token: string;
      user: { email: string; role: string; organizationId: string };
    };
    if (!ROLES_PANEL.includes(data.user.role)) {
      throw new Error(
        "Este acceso es solo para gestores de empresa. Si eres jefe de cuadrilla, usa la app de campo.",
      );
    }
    const g: Guardada = {
      token: data.token,
      email: data.user.email,
      role: data.user.role,
      organizationId: data.user.organizationId,
    };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(g));
    } catch {
      /* se pierde al recargar, pero la sesión de esta pestaña vale */
    }
    this.#aplicar(g);
    this.estado = "dentro";
  }

  salir(): void {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada */
    }
    this.token = null;
    this.email = null;
    this.role = "";
    this.organizationId = "";
    this.estado = "fuera";
  }

  #aplicar(g: Guardada): void {
    this.token = g.token;
    this.email = g.email;
    this.role = g.role;
    this.organizationId = g.organizationId;
  }
}

export const sesion = new Sesion();
