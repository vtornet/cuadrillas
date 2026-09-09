<script lang="ts">
  import type { Shift, Crew } from "@cuadrilla/shared";
  import { api } from "../lib/api";
  import { router } from "../lib/router.svelte";

  type Fila = Shift & { cuadrilla: string; producto: string; unidad: string };

  let crews = $state<Crew[]>([]);
  let filas = $state<Fila[] | null>(null);
  let error = $state<string | null>(null);

  let crewId = $state("");
  let desde = $state("");
  let hasta = $state("");

  async function cargar(): Promise<void> {
    filas = null;
    error = null;
    try {
      filas = await api<Fila[]>("/partes", {
        crewId: crewId || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  $effect(() => {
    api<Crew[]>("/cuadrillas").then((c) => (crews = c)).catch(() => {});
  });

  let t: ReturnType<typeof setTimeout>;
  $effect(() => {
    crewId;
    desde;
    hasta;
    clearTimeout(t);
    t = setTimeout(cargar, 150);
  });

  function horario(s: Fila): string {
    return s.horaInicio ? `${s.horaInicio}–${s.horaFin ?? "…"}` : "";
  }
</script>

<h1>Partes</h1>

<div class="filtros">
  <select bind:value={crewId}>
    <option value="">Todas las cuadrillas</option>
    {#each crews as c (c.id)}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
  <label>Desde <input type="date" bind:value={desde} /></label>
  <label>Hasta <input type="date" bind:value={hasta} /></label>
</div>

{#if error}
  <p class="aviso">{error}</p>
{:else if !filas}
  <p class="cargando">Cargando…</p>
{:else if filas.length === 0}
  <p class="vacio">Sin partes.</p>
{:else}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Cuadrilla</th>
          <th>Producto</th>
          <th>Finca</th>
          <th>Horario</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {#each filas as s (s.id)}
          <tr class="clic" onclick={() => router.ir("partes", s.id)}>
            <td>{s.fecha}</td>
            <td>{s.cuadrilla}</td>
            <td>{s.producto} · {s.unidad}</td>
            <td>{s.finca ?? "—"}</td>
            <td>{horario(s)}</td>
            <td>{s.estado === "open" ? "Abierto" : "Cerrado"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
