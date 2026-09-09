<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew } from "@cuadrilla/shared";
  import { api } from "../lib/api";
  import { router } from "../lib/router.svelte";

  type Fila = Crew & { numTrabajadores: number };

  let filas = $state<Fila[] | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      filas = await api<Fila[]>("/cuadrillas");
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  });
</script>

<h1>Cuadrillas</h1>

{#if error}
  <p class="aviso">{error}</p>
{:else if !filas}
  <p class="cargando">Cargando…</p>
{:else if filas.length === 0}
  <p class="vacio">Todavía no hay cuadrillas.</p>
{:else}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr>
          <th>Cuadrilla</th>
          <th>Trabajadores</th>
        </tr>
      </thead>
      <tbody>
        {#each filas as c (c.id)}
          <tr class="clic" onclick={() => router.ir("trabajadores", c.id)}>
            <td>{c.name}</td>
            <td>{c.numTrabajadores}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
