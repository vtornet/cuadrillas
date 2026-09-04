<script lang="ts">
  import { onMount } from "svelte";
  import type { Product, Shift, UnitType } from "@cuadrilla/shared";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { crewsDelForeman } from "../lib/db/repositories/crews";
  import { shiftsDeCuadrillas } from "../lib/db/repositories/shifts";
  import {
    todasLasUnidades,
    todosLosProductos,
  } from "../lib/db/repositories/products";
  import AppBar from "../lib/components/AppBar.svelte";
  import ParteDetalle from "../lib/components/ParteDetalle.svelte";

  let cerrados = $state<Shift[]>([]);
  let crewNombre = $state<Record<string, string>>({});
  let productos = $state<Product[]>([]);
  let unidades = $state<UnitType[]>([]);
  let cargado = $state(false);
  let parteAbiertoId = $state<string | null>(null);

  onMount(async () => {
    const crews = await crewsDelForeman(sesion.userId);
    const nombres: Record<string, string> = {};
    for (const c of crews) nombres[c.id] = c.name;
    crewNombre = nombres;

    const [todos, prods, units] = await Promise.all([
      shiftsDeCuadrillas(crews.map((c) => c.id)),
      todosLosProductos(sesion.organizationId),
      todasLasUnidades(sesion.organizationId),
    ]);
    cerrados = todos.filter((s) => s.estado === "closed");
    productos = prods;
    unidades = units;
    cargado = true;
  });

  function nombreProducto(id: string): string {
    return productos.find((p) => p.id === id)?.name ?? "?";
  }
  function nombreUnidad(id: string): string {
    return unidades.find((u) => u.id === id)?.name ?? "?";
  }
</script>

{#if parteAbiertoId}
  {#key parteAbiertoId}
    <ParteDetalle
      shiftId={parteAbiertoId}
      onclose={() => (parteAbiertoId = null)}
    />
  {/key}
{:else}
  <div class="pantalla">
    <header class="cabecera">
      <AppBar titulo={i18n.t("historial.titulo")} />
    </header>
    <div class="pantalla-cuerpo">
      {#if !cargado}
        <p class="vacio-lista">{i18n.t("app.cargando")}</p>
      {:else if cerrados.length === 0}
        <p class="vacio-lista">{i18n.t("historial.sin_partes")}</p>
      {:else}
        {#each cerrados as s (s.id)}
          <button
            type="button"
            class="fila-gestion"
            onclick={() => (parteAbiertoId = s.id)}
          >
            <span class="fg-main">
              {nombreProducto(s.productId)} · {nombreUnidad(s.unitTypeId)}
            </span>
            <span class="fg-sub">
              {crewNombre[s.crewId] ?? "?"} &middot; {s.fecha}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
{/if}
