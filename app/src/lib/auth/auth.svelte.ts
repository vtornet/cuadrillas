import { db } from "../db/dexie";
import { delMeta, getMeta, setMeta } from "../db/meta";
import { API_URL, HAY_BACKEND } from "../config";

export type EstadoAuth = "cargando" | "anonimo" | "demo" | "autenticado";

interface SesionGuardada {
  token: string;
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

interface RespuestaVerify {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  };
}

const META_SESION = "sesion";
const META_DEMO = "modoDemo";

class Auth {
  estado = $state<EstadoAuth>("cargando");
  email = $state<string | null>(null);
  organizationId = $state("demo-org");
  userId = $state("demo-user");
  role = $state("foreman");
  /** No reactivo: solo lo usa el motor de sync. */
  token: string | null = null;

  get autenticado(): boolean {
    return this.estado === "autenticado";
  }

  async cargar(): Promise<void> {
    const sesion = await getMeta<SesionGuardada>(META_SESION);
    if (sesion?.token) {
      this.#aplicar(sesion);
      this.estado = "autenticado";
      return;
    }
    const demo = await getMeta<boolean>(META_DEMO);
    if (demo || !HAY_BACKEND) {
      this.estado = "demo";
      return;
    }
    this.estado = "anonimo";
  }

  async entrarModoDemo(): Promise<void> {
    await setMeta(META_DEMO, true);
    this.estado = "demo";
  }

  /** Pide un enlace magico. Devuelve `enlace` en desarrollo. */
  async pedirEnlace(email: string): Promise<{ enlace?: string }> {
    const r = await fetch(`${API_URL}/auth/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error("No se pudo enviar el enlace");
    return r.json();
  }

  /** Canjea el token del enlace magico por una sesion. */
  async verificar(tokenMagico: string): Promise<void> {
    const r = await fetch(`${API_URL}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: tokenMagico }),
    });
    if (!r.ok) throw new Error("Enlace caducado o invalido");
    const data = (await r.json()) as RespuestaVerify;

    // Primer login: limpia datos de demo o de otra sesion.
    await this.#limpiarDatosLocales();

    const sesion: SesionGuardada = {
      token: data.token,
      userId: data.user.id,
      organizationId: data.user.organizationId,
      role: data.user.role,
      email: data.user.email,
    };
    await setMeta(META_SESION, sesion);
    await delMeta(META_DEMO);
    this.#aplicar(sesion);
    this.estado = "autenticado";
  }

  async salir(): Promise<void> {
    await this.#limpiarDatosLocales();
    await delMeta(META_SESION);
    await delMeta(META_DEMO);
    this.token = null;
    this.email = null;
    this.userId = "demo-user";
    this.organizationId = "demo-org";
    this.estado = HAY_BACKEND ? "anonimo" : "demo";
  }

  #aplicar(s: SesionGuardada): void {
    this.token = s.token;
    this.userId = s.userId;
    this.organizationId = s.organizationId;
    this.role = s.role;
    this.email = s.email;
  }

  async #limpiarDatosLocales(): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.organizations,
        db.crews,
        db.workers,
        db.groups,
        db.fincas,
        db.products,
        db.unitTypes,
        db.rates,
        db.shifts,
        db.entries,
        db.pendingOps,
        db.meta,
      ],
      async () => {
        await Promise.all([
          db.organizations.clear(),
          db.crews.clear(),
          db.workers.clear(),
          db.groups.clear(),
          db.fincas.clear(),
          db.products.clear(),
          db.unitTypes.clear(),
          db.rates.clear(),
          db.shifts.clear(),
          db.entries.clear(),
          db.pendingOps.clear(),
        ]);
        await db.meta
          .where("key")
          .anyOf(["demoSeed", "activeShiftId", "lastSyncAt"])
          .delete();
      },
    );
  }
}

export const auth = new Auth();
