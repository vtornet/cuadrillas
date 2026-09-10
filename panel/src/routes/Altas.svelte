<script lang="ts">
  import type { Worker, Crew } from "@cuadrilla/shared";
  import { estadoAlta, faltanDatosAlta } from "@cuadrilla/shared/domain";
  import { get } from "../lib/api";
  import FichaLaboral from "../lib/FichaLaboral.svelte";

  type Fila = Worker & { cuadrilla: string };

  let filas = $state<Fila[] | null>(null);
  let crews = $state<Crew[]>([]);
  let error = $state<string | null>(null);

  let filtro = $state<"pendientes" | "completas" | "todas">("pendientes");
  let crewId = $state("");
  let abierto = $state<string | null>(null);

  async function cargar(): Promise<void> {
    error = null;
    try {
      [filas, crews] = await Promise.all([
        get<Fila[]>("/trabajadores"),
        get<Crew[]>("/cuadrillas"),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }
  $effect(() => {
    if (!filas) cargar();
  });

  const visibles = $derived(
    (filas ?? [])
      .filter((w) => !crewId || w.crewId === crewId)
      .filter((w) => {
        if (filtro === "todas") return true;
        const e = estadoAlta(w);
        return filtro === "pendientes" ? e === "pendiente" : e === "completa";
      }),
  );

  const pendientes = $derived(
    (filas ?? []).filter((w) => estadoAlta(w) === "pendiente").length,
  );

  function trasGuardar(w: Fila): void {
    if (!filas) return;
    filas = filas.map((x) => (x.id === w.id ? { ...x, ...w } : x));
  }
</script>

<h1>Altas</h1>
<p style="color:var(--suave)">
  Completa los datos laborales de cada trabajador (DNI, nº SS, IBAN, fecha de
  alta). Los rellena la empresa; el jefe de cuadrilla solo da el alta rápida.
  {#if filas}· <strong>{pendientes}</strong> pendiente(s).{/if}
</p>

{#if error}<p class="aviso">{error}</p>{/if}

<div class="filtros">
  <select bind:value={filtro}>
    <option value="pendientes">Pendientes</option>
    <option value="completas">Completas</option>
    <option value="todas">Todas</option>
  </select>
  <select bind:value={crewId}>
    <option value="">Todas las cuadrillas</option>
    {#each crews as c (c.id)}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
</div>

{#if !filas}
  <p class="cargando">Cargando…</p>
{:else if visibles.length === 0}
  <p class="vacio">Nada que mostrar con este filtro.</p>
{:else}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr>
          <th>Trabajador</th>
          <th>Cuadrilla</th>
          <th>Estado</th>
          <th>Faltan</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each visibles as w (w.id)}
          <tr>
            <td>{w.name} <em style="color:var(--suave)">{w.alias}</em></td>
            <td>{w.cuadrilla}</td>
            <td>
              {#if estadoAlta(w) === "completa"}
                <span style="color:#067647;font-weight:700">completa</span>
              {:else}
                <span style="color:#b54708;font-weight:700">pendiente</span>
              {/if}
            </td>
            <td style="color:var(--suave)">
              {faltanDatosAlta(w).join(", ") || "—"}
            </td>
            <td>
              <button
                type="button"
                onclick={() => (abierto = abierto === w.id ? null : w.id)}
              >
                {abierto === w.id ? "Cerrar" : "Editar"}
              </button>
            </td>
          </tr>
          {#if abierto === w.id}
            <tr>
              <td colspan="5" style="background:var(--fondo)">
                {#key w.id}
                  <FichaLaboral worker={w} onguardado={trasGuardar} />
                {/key}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
