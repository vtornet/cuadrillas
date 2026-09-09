<script lang="ts">
  import { onMount } from "svelte";
  import type { Product, Shift, UnitType } from "@cuadrilla/shared";
  import { etiquetaProducto, fechaES } from "@cuadrilla/shared/domain";
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

  let orden = $state<"desc" | "asc">("desc");
  let filtroCrew = $state("");
  let filtroFinca = $state("");
  let filtroProducto = $state("");

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
    const p = productos.find((p) => p.id === id);
    return p ? etiquetaProducto(p) : "?";
  }
  function nombreUnidad(id: string): string {
    return unidades.find((u) => u.id === id)?.name ?? "?";
  }

  // Opciones de filtro derivadas de los partes que hay.
  const crewsConPartes = $derived(
    [...new Set(cerrados.map((s) => s.crewId))]
      .map((id) => ({ id, name: crewNombre[id] ?? "?" }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  );
  const fincasConPartes = $derived(
    [...new Set(cerrados.map((s) => s.finca?.trim()).filter(Boolean))].sort(
      (a, b) => (a as string).localeCompare(b as string, "es"),
    ) as string[],
  );
  const productosConPartes = $derived(
    [...new Set(cerrados.map((s) => s.productId))]
      .map((id) => ({ id, label: nombreProducto(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "es")),
  );

  const visibles = $derived(
    cerrados
      .filter((s) => !filtroCrew || s.crewId === filtroCrew)
      .filter((s) => !filtroFinca || s.finca?.trim() === filtroFinca)
      .filter((s) => !filtroProducto || s.productId === filtroProducto)
      .slice()
      .sort((a, b) => {
        const d = a.fecha.localeCompare(b.fecha) || a.updatedAt - b.updatedAt;
        return orden === "asc" ? d : -d;
      }),
  );

  const hayFiltros = $derived(
    !!filtroCrew || !!filtroFinca || !!filtroProducto,
  );
  function limpiarFiltros(): void {
    filtroCrew = "";
    filtroFinca = "";
    filtroProducto = "";
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
        <div class="hist-filtros">
          <div class="hf-fila">
            <button
              type="button"
              class="hf-orden"
              onclick={() => (orden = orden === "desc" ? "asc" : "desc")}
            >
              {orden === "desc"
                ? i18n.t("historial.orden_desc")
                : i18n.t("historial.orden_asc")}
            </button>
            {#if hayFiltros}
              <button type="button" class="hf-limpiar" onclick={limpiarFiltros}>
                {i18n.t("historial.limpiar_filtros")}
              </button>
            {/if}
          </div>
          <div class="hf-fila">
            {#if crewsConPartes.length > 1}
              <select bind:value={filtroCrew} aria-label={i18n.t("jornada.cuadrilla")}>
                <option value="">{i18n.t("historial.todas_cuadrillas")}</option>
                {#each crewsConPartes as c (c.id)}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
            {/if}
            {#if fincasConPartes.length > 0}
              <select bind:value={filtroFinca} aria-label={i18n.t("jornada.finca")}>
                <option value="">{i18n.t("historial.todas_fincas")}</option>
                {#each fincasConPartes as f (f)}
                  <option value={f}>{f}</option>
                {/each}
              </select>
            {/if}
            {#if productosConPartes.length > 1}
              <select
                bind:value={filtroProducto}
                aria-label={i18n.t("jornada.producto")}
              >
                <option value="">{i18n.t("historial.todos_productos")}</option>
                {#each productosConPartes as p (p.id)}
                  <option value={p.id}>{p.label}</option>
                {/each}
              </select>
            {/if}
          </div>
        </div>

        {#each visibles as s (s.id)}
          <button
            type="button"
            class="fila-gestion"
            onclick={() => (parteAbiertoId = s.id)}
          >
            <span class="fg-main">
              {nombreProducto(s.productId)} · {nombreUnidad(s.unitTypeId)}
            </span>
            <span class="fg-sub">
              {[crewNombre[s.crewId] ?? "?", fechaES(s.fecha), s.finca]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
        {:else}
          <p class="vacio-lista">{i18n.t("historial.sin_coincidencias")}</p>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .hist-filtros {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  .hf-fila {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .hf-fila select {
    flex: 1 1 8rem;
    min-height: var(--tap);
  }
  .hf-orden {
    min-height: var(--tap);
    padding: 0 14px;
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    background: var(--c-superficie);
    font-weight: 600;
  }
  .hf-limpiar {
    min-height: var(--tap);
    padding: 0 12px;
    background: none;
    color: var(--c-texto-suave);
    text-decoration: underline;
  }
</style>
