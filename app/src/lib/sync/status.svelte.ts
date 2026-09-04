import { liveQuery } from "dexie";
import { db } from "../db/dexie";
import { getMeta } from "../db/meta";
import { auth } from "../auth/auth.svelte";
import { sincronizar } from "./engine";

/**
 * Estado de sincronizacion para la interfaz y disparador automatico:
 * al volver la red, tras cada escritura local (con rebote) y cada 30 s.
 */
class SyncStatus {
  online = $state(
    typeof navigator !== "undefined" ? navigator.onLine !== false : true,
  );
  pendientes = $state(0);
  ultimoSync = $state<number | null>(null);
  sincronizando = $state(false);
  rechazos = $state<Array<{ id: string; reason: string }>>([]);

  #rebote: ReturnType<typeof setTimeout> | null = null;
  #intervalo: ReturnType<typeof setInterval> | null = null;
  #arrancado = false;

  constructor() {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.online = true;
      void this.sincronizarAhora();
    });
    window.addEventListener("offline", () => (this.online = false));

    liveQuery(() => db.pendingOps.count()).subscribe({
      next: (n) => {
        this.pendientes = n;
        if (n > 0) this.#programar();
      },
      error: (e) => console.error("[sync] liveQuery pendingOps", e),
    });
  }

  /** Se llama tras `auth.cargar()`, cuando ya se sabe si hay sesion. */
  arrancar(): void {
    if (this.#arrancado || typeof window === "undefined") return;
    this.#arrancado = true;
    void this.#leerUltimoSync();
    void this.sincronizarAhora();
    this.#intervalo = setInterval(() => {
      if (this.online) void this.sincronizarAhora();
    }, 30_000);
  }

  async sincronizarAhora(): Promise<void> {
    if (this.sincronizando || !auth.autenticado) return;
    this.sincronizando = true;
    try {
      const r = await sincronizar();
      if (r.ok) {
        await this.#leerUltimoSync();
        if (r.rechazos && r.rechazos.length > 0) {
          this.rechazos = [...this.rechazos, ...r.rechazos];
        }
      }
    } finally {
      this.sincronizando = false;
    }
  }

  descartarRechazos(): void {
    this.rechazos = [];
  }

  async refrescarPendientes(): Promise<void> {
    this.pendientes = await db.pendingOps.count();
  }

  #programar(): void {
    if (this.#rebote) clearTimeout(this.#rebote);
    this.#rebote = setTimeout(() => void this.sincronizarAhora(), 2000);
  }

  async #leerUltimoSync(): Promise<void> {
    const iso = await getMeta<string>("lastSyncAt");
    this.ultimoSync = iso ? new Date(iso).getTime() : null;
  }
}

export const syncStatus = new SyncStatus();
