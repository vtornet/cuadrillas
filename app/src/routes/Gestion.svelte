<script lang="ts">
  import { onMount } from "svelte";
  import type {
    Crew,
    Group,
    Product,
    Rate,
    UnitType,
    Worker,
  } from "@cuadrilla/shared";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { gestion } from "../lib/stores/gestion.svelte";
  import { centimosAEuros } from "../lib/money";
  import AppBar from "../lib/components/AppBar.svelte";
  import CrewForm from "../lib/components/gestion/CrewForm.svelte";
  import WorkerForm from "../lib/components/gestion/WorkerForm.svelte";
  import GroupForm from "../lib/components/gestion/GroupForm.svelte";
  import ProductForm from "../lib/components/gestion/ProductForm.svelte";
  import UnitForm from "../lib/components/gestion/UnitForm.svelte";
  import RateForm from "../lib/components/gestion/RateForm.svelte";
  import ImportWorkersSheet from "../lib/components/gestion/ImportWorkersSheet.svelte";

  type Tab = "crews" | "workers" | "groups" | "products" | "units" | "rates";
  type Registro = Crew | Worker | Group | Product | UnitType | Rate;

  let tab = $state<Tab>("workers");
  let editando = $state<{ tab: Tab; registro: Registro | null } | null>(null);
  let importAbierto = $state(false);
  let mensaje = $state<string | null>(null);

  onMount(() => gestion.cargar());

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "crews", label: i18n.t("gestion.cuadrillas") },
    { id: "workers", label: i18n.t("gestion.trabajadores") },
    { id: "groups", label: i18n.t("gestion.grupos") },
    { id: "products", label: i18n.t("gestion.productos") },
    { id: "units", label: i18n.t("gestion.unidades") },
    { id: "rates", label: i18n.t("gestion.tarifas") },
  ];

  function nuevo(): void {
    editando = { tab, registro: null };
  }
  function editar(registro: Registro): void {
    editando = { tab, registro };
  }
  function editarWorker(worker: Worker): void {
    editando = { tab: "workers", registro: worker };
  }
  function cerrar(): void {
    editando = null;
  }

  function vigencia(r: Rate): string {
    return r.validTo
      ? `${r.validFrom} → ${r.validTo}`
      : i18n.t("gestion.desde_fecha", { fecha: r.validFrom });
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("gestion.titulo")} />
    <div class="tabs">
      {#each tabs as t (t.id)}
        <button
          type="button"
          class="tab"
          class:activo={tab === t.id}
          onclick={() => (tab = t.id)}
        >
          {t.label}
        </button>
      {/each}
    </div>
  </header>

  <div class="pantalla-cuerpo">
    {#if tab === "crews"}
      {#each gestion.crews as c (c.id)}
        <button type="button" class="fila-gestion" onclick={() => editar(c)}>
          <span class="fg-main">{c.name}</span>
          <span class="fg-sub">
            {i18n.t("gestion.cuadrilla_trabajadores", {
              n: gestion.trabajadoresDe(c.id).length,
            })}
          </span>
        </button>
      {:else}
        <p class="vacio-lista">{i18n.t("gestion.lista_vacia")}</p>
      {/each}
    {:else if tab === "workers"}
      {#each gestion.workers as w (w.id)}
        <button type="button" class="fila-gestion" onclick={() => editar(w)}>
          <span class="fg-main">{w.name} <em>{w.alias}</em></span>
          <span class="fg-sub">
            {gestion.nombreCrew(w.crewId)}
            {#if w.activo === 0} &middot; {i18n.t("gestion.inactivo")}{/if}
          </span>
        </button>
      {:else}
        <p class="vacio-lista">{i18n.t("gestion.lista_vacia")}</p>
      {/each}
    {:else if tab === "groups"}
      {#each gestion.groups as g (g.id)}
        <button type="button" class="fila-gestion" onclick={() => editar(g)}>
          <span class="fg-main">{g.name}</span>
          <span class="fg-sub">
            {gestion.nombreCrew(g.crewId)} &middot;
            {i18n.t("grupo.miembros_contador", { n: g.memberIds.length })}
            {#if g.activo === 0} &middot; {i18n.t("gestion.inactivo")}{/if}
          </span>
        </button>
      {:else}
        <p class="vacio-lista">{i18n.t("gestion.lista_vacia")}</p>
      {/each}
    {:else if tab === "products"}
      {#each gestion.products as p (p.id)}
        <button type="button" class="fila-gestion" onclick={() => editar(p)}>
          <span class="fg-main">{p.name}</span>
          {#if p.activo === 0}
            <span class="fg-sub">{i18n.t("gestion.inactivo")}</span>
          {/if}
        </button>
      {:else}
        <p class="vacio-lista">{i18n.t("gestion.lista_vacia")}</p>
      {/each}
    {:else if tab === "units"}
      {#each gestion.units as u (u.id)}
        <button type="button" class="fila-gestion" onclick={() => editar(u)}>
          <span class="fg-main">{u.name} <em>{u.abbr}</em></span>
          <span class="fg-sub">
            {u.productId
              ? gestion.nombreProducto(u.productId)
              : i18n.t("gestion.global")}
          </span>
        </button>
      {:else}
        <p class="vacio-lista">{i18n.t("gestion.lista_vacia")}</p>
      {/each}
    {:else}
      {#each gestion.rates as r (r.id)}
        <button type="button" class="fila-gestion" onclick={() => editar(r)}>
          <span class="fg-main">
            {centimosAEuros(r.amountPerUnit)} / {gestion.nombreUnidad(r.unitTypeId)}
          </span>
          <span class="fg-sub">
            {gestion.nombreProducto(r.productId)} &middot; {vigencia(r)}
          </span>
        </button>
      {:else}
        <p class="vacio-lista">{i18n.t("gestion.lista_vacia")}</p>
      {/each}
    {/if}
  </div>

  {#if mensaje}
    <button
      type="button"
      class="gestion-aviso"
      onclick={() => (mensaje = null)}
    >
      {mensaje}
    </button>
  {/if}

  <div class="acciones">
    {#if tab === "workers"}
      <button
        type="button"
        class="btn-secundario"
        onclick={() => (importAbierto = true)}
      >
        {i18n.t("gestion.importar_trabajadores")}
      </button>
    {/if}
    <button type="button" class="btn-primario btn-anadir" onclick={nuevo}>
      {i18n.t("gestion.anadir")}
    </button>
  </div>

  {#if importAbierto}
    <ImportWorkersSheet
      onclose={() => (importAbierto = false)}
      onhecho={(n) => (mensaje = i18n.t("gestion.import_hecho", { n }))}
    />
  {/if}

  {#if editando}
    {@const e = editando}
    {#if e.tab === "crews"}
      <CrewForm
        registro={e.registro as Crew | null}
        onclose={cerrar}
        oneditarworker={editarWorker}
      />
    {:else if e.tab === "workers"}
      <WorkerForm registro={e.registro as Worker | null} onclose={cerrar} />
    {:else if e.tab === "groups"}
      <GroupForm registro={e.registro as Group | null} onclose={cerrar} />
    {:else if e.tab === "products"}
      <ProductForm registro={e.registro as Product | null} onclose={cerrar} />
    {:else if e.tab === "units"}
      <UnitForm registro={e.registro as UnitType | null} onclose={cerrar} />
    {:else}
      <RateForm registro={e.registro as Rate | null} onclose={cerrar} />
    {/if}
  {/if}
</div>
