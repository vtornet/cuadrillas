<script lang="ts">
  import { onMount } from "svelte";
  import { sesion } from "./lib/sesion.svelte";
  import { router, VISTAS } from "./lib/router.svelte";
  import Login from "./routes/Login.svelte";
  import Resumen from "./routes/Resumen.svelte";
  import Cuadrillas from "./routes/Cuadrillas.svelte";
  import Trabajadores from "./routes/Trabajadores.svelte";
  import Partes from "./routes/Partes.svelte";
  import ParteDetalle from "./routes/ParteDetalle.svelte";
  import Asistencia from "./routes/Asistencia.svelte";
  import Tarifas from "./routes/Tarifas.svelte";
  import Liquidacion from "./routes/Liquidacion.svelte";

  let errorEntrada = $state<string | null>(null);

  onMount(async () => {
    // Enlace mágico: #/entrar?token=XXXX
    const m = location.hash.match(/[?&]token=([^&]+)/);
    if (m && location.hash.startsWith("#/entrar")) {
      try {
        await sesion.verificar(decodeURIComponent(m[1]));
        location.hash = "#/resumen";
      } catch (e) {
        errorEntrada = e instanceof Error ? e.message : "No se pudo entrar";
        location.hash = "";
      }
      return;
    }
    sesion.cargar();
  });
</script>

{#if sesion.estado === "cargando"}
  <p class="cargando" style="padding:32px">Cargando…</p>
{:else if sesion.estado === "fuera"}
  <Login error={errorEntrada} />
{:else}
  <div class="layout">
    <nav class="lateral">
      <div class="marca">Cuadrillas · Panel</div>
      {#each VISTAS as v (v.id)}
        <a
          href={`#/${v.id}`}
          class:activo={router.vista === v.id}
        >
          {v.etiqueta}
        </a>
      {/each}
      <div class="pie">
        {sesion.email}
        <button type="button" onclick={() => sesion.salir()}>Salir</button>
      </div>
    </nav>

    <main class="contenido">
      {#if router.vista === "resumen"}
        <Resumen />
      {:else if router.vista === "cuadrillas"}
        <Cuadrillas />
      {:else if router.vista === "trabajadores"}
        <Trabajadores />
      {:else if router.vista === "partes" && router.param}
        {#key router.param}
          <ParteDetalle id={router.param} />
        {/key}
      {:else if router.vista === "partes"}
        <Partes />
      {:else if router.vista === "asistencia"}
        <Asistencia />
      {:else if router.vista === "tarifas"}
        <Tarifas />
      {:else if router.vista === "liquidacion"}
        <Liquidacion />
      {/if}
    </main>
  </div>
{/if}
