<script lang="ts">
  import type { Crew } from "@cuadrilla/shared";
  import { api, get } from "../lib/api";
  import { API_URL } from "../lib/config";
  import { sesion } from "../lib/sesion.svelte";

  interface Jefe {
    id: string;
    email: string;
    role: string;
    cuadrillas: { id: string; name: string }[];
  }
  interface Equipo {
    jefes: Jefe[];
    invitaciones: { token: string; email: string; expiresAt: string }[];
    limite: number;
    ocupados: number;
  }

  let eq = $state<Equipo | null>(null);
  let crews = $state<Crew[]>([]);
  let error = $state<string | null>(null);

  async function cargar(): Promise<void> {
    error = null;
    try {
      [eq, crews] = await Promise.all([
        get<Equipo>("/equipo"),
        get<Crew[]>("/cuadrillas"),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }
  $effect(() => {
    if (!eq) cargar();
  });

  const alLimite = $derived(!!eq && eq.ocupados >= eq.limite);

  // Invitación
  let invEmail = $state("");
  let invCrews = $state<Set<string>>(new Set());
  let invitando = $state(false);
  let invMsg = $state<string | null>(null);

  function toggleInv(id: string): void {
    const s = new Set(invCrews);
    s.has(id) ? s.delete(id) : s.add(id);
    invCrews = s;
  }

  async function invitar(): Promise<void> {
    if (!invEmail.trim() || invitando) return;
    invitando = true;
    invMsg = null;
    error = null;
    try {
      const r = await api<{ enlace?: string }>("/invitaciones", {
        metodo: "POST",
        body: { email: invEmail.trim(), crewIds: [...invCrews] },
      });
      invMsg = r.enlace
        ? `Invitación creada. (dev) ${r.enlace}`
        : "Invitación enviada por email.";
      invEmail = "";
      invCrews = new Set();
      eq = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al invitar";
    } finally {
      invitando = false;
    }
  }

  async function revocar(token: string): Promise<void> {
    try {
      await api(`/invitaciones/${token}`, { metodo: "DELETE" });
      eq = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  // Reasignar cuadrillas de un jefe
  let editando = $state<string | null>(null);
  let sel = $state<Set<string>>(new Set());
  function abrirEdicion(j: Jefe): void {
    editando = j.id;
    sel = new Set(j.cuadrillas.map((c) => c.id));
  }
  function toggleSel(id: string): void {
    const s = new Set(sel);
    s.has(id) ? s.delete(id) : s.add(id);
    sel = s;
  }
  async function guardarAsignacion(id: string): Promise<void> {
    try {
      await api(`/jefes/${id}/cuadrillas`, {
        metodo: "PUT",
        body: { crewIds: [...sel] },
      });
      editando = null;
      eq = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  async function cambiarAEmpresa(): Promise<void> {
    try {
      const r = await fetch(`${API_URL}/billing/checkout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sesion.token}`,
        },
        body: JSON.stringify({ plan: "company" }),
      });
      if (r.status === 503) {
        error = "Los pagos no están disponibles todavía.";
        return;
      }
      const data = (await r.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else error = data.error ?? "No se pudo abrir la pasarela de pago.";
    } catch {
      error = "No se pudo abrir la pasarela de pago.";
    }
  }
</script>

<h1>Equipo</h1>

{#if error}<p class="aviso">{error}</p>{/if}

{#if !eq}
  <p class="cargando">Cargando…</p>
{:else}
  <p style="color:var(--suave)">
    Jefes de cuadrilla: <strong>{eq.ocupados}</strong> de {eq.limite} del plan.
  </p>

  <h2>Invitar jefe de cuadrilla</h2>
  {#if alLimite}
    <p>
      Tu plan permite {eq.limite} jefe(s). Para invitar a más, cambia al
      <strong>plan Empresa</strong>.
      <button type="button" class="primario" onclick={cambiarAEmpresa}>
        Cambiar de plan
      </button>
    </p>
  {:else}
    <div class="tarjeta" style="max-width:520px">
      <label style="display:block;margin-bottom:8px">
        Email del jefe
        <input type="email" bind:value={invEmail} placeholder="jefe@correo.com" />
      </label>
      {#if crews.length > 0}
        <p style="margin:6px 0 4px;color:var(--suave)">Cuadrillas que lidera:</p>
        <div class="checks">
          {#each crews as c (c.id)}
            <label>
              <input
                type="checkbox"
                checked={invCrews.has(c.id)}
                onchange={() => toggleInv(c.id)}
              /> {c.name}
            </label>
          {/each}
        </div>
      {/if}
      <button
        type="button"
        class="primario"
        style="margin-top:10px"
        disabled={invitando}
        onclick={invitar}
      >
        {invitando ? "Enviando…" : "Enviar invitación"}
      </button>
      {#if invMsg}<p class="ok" style="word-break:break-all">{invMsg}</p>{/if}
    </div>
  {/if}

  {#if eq.invitaciones.length > 0}
    <h2>Invitaciones pendientes</h2>
    <div class="tabla-wrap">
      <table class="datos">
        <thead>
          <tr><th>Email</th><th>Caduca</th><th></th></tr>
        </thead>
        <tbody>
          {#each eq.invitaciones as i (i.token)}
            <tr>
              <td>{i.email}</td>
              <td>{new Date(i.expiresAt).toLocaleDateString("es-ES")}</td>
              <td>
                <button type="button" onclick={() => revocar(i.token)}>
                  Revocar
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <h2>Jefes actuales</h2>
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr><th>Email</th><th>Rol</th><th>Cuadrillas</th><th></th></tr>
      </thead>
      <tbody>
        {#each eq.jefes as j (j.id)}
          <tr>
            <td>{j.email}</td>
            <td>{j.role === "owner" ? "Propietario" : "Jefe"}</td>
            <td>
              {#if editando === j.id}
                <div class="checks">
                  {#each crews as c (c.id)}
                    <label>
                      <input
                        type="checkbox"
                        checked={sel.has(c.id)}
                        onchange={() => toggleSel(c.id)}
                      /> {c.name}
                    </label>
                  {/each}
                </div>
              {:else}
                {j.cuadrillas.map((c) => c.name).join(", ") || "—"}
              {/if}
            </td>
            <td style="white-space:nowrap">
              {#if editando === j.id}
                <button
                  type="button"
                  class="primario"
                  onclick={() => guardarAsignacion(j.id)}
                >
                  Guardar
                </button>
                <button type="button" onclick={() => (editando = null)}>
                  Cancelar
                </button>
              {:else}
                <button type="button" onclick={() => abrirEdicion(j)}>
                  Cuadrillas
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
  }
  .checks label {
    font-size: 14px;
    white-space: nowrap;
  }
</style>
