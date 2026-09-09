<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";

  interface Datos {
    cuadrillas: number;
    trabajadoresActivos: number;
    partesMes: number;
    partesAbiertos: number;
  }

  let datos = $state<Datos | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      datos = await api<Datos>("/resumen");
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  });
</script>

<h1>Resumen</h1>

{#if error}
  <p class="aviso">{error}</p>
{:else if !datos}
  <p class="cargando">Cargando…</p>
{:else}
  <div class="tarjetas">
    <div class="tarjeta">
      <div class="n">{datos.cuadrillas}</div>
      <div class="et">Cuadrillas</div>
    </div>
    <div class="tarjeta">
      <div class="n">{datos.trabajadoresActivos}</div>
      <div class="et">Trabajadores activos</div>
    </div>
    <div class="tarjeta">
      <div class="n">{datos.partesMes}</div>
      <div class="et">Partes este mes</div>
    </div>
    <div class="tarjeta">
      <div class="n">{datos.partesAbiertos}</div>
      <div class="et">Partes abiertos</div>
    </div>
  </div>
{/if}
