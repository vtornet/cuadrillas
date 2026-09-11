<script lang="ts">
  import { onMount } from "svelte";
  import type { Organization } from "@cuadrilla/shared";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { router, type Vista } from "../lib/stores/router.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { obtenerOrganizacion } from "../lib/db/repositories/organizations";
  import { PANEL_URL } from "../lib/config";
  import AppBar from "../lib/components/AppBar.svelte";

  /**
   * Pantalla de inicio: los mismos accesos que antes vivían en el menú
   * hamburguesa, ahora como página propia con botones grandes. El botón de
   * arriba a la izquierda (en cualquier pantalla, vía AppBar) siempre trae
   * de vuelta aquí.
   */

  let org = $state<Organization | null>(null);

  onMount(async () => {
    org = (await obtenerOrganizacion(sesion.organizationId)) ?? null;
  });

  // "Empresas" = plan con panel (company/campaign); foreman/free no lo tienen.
  const esEmpresa = $derived(org?.plan === "company" || org?.plan === "campaign");

  const items: Array<{ v: Vista; label: string }> = [
    { v: "registro", label: i18n.t("menu.registrar") },
    { v: "historial", label: i18n.t("menu.historial") },
    { v: "estadisticas", label: i18n.t("menu.estadisticas") },
    { v: "asistencia", label: i18n.t("menu.asistencia") },
    { v: "gestion", label: i18n.t("menu.gestion") },
    { v: "cuenta", label: i18n.t("menu.cuenta") },
    { v: "privacidad", label: i18n.t("menu.privacidad") },
  ];

  function abrirPanel(): void {
    window.open(PANEL_URL, "_blank", "noopener,noreferrer");
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("inicio.titulo")} />
  </header>

  <div class="pantalla-cuerpo">
    <nav class="menu-lista">
      {#each items as it (it.v)}
        <button type="button" class="menu-item" onclick={() => router.ir(it.v)}>
          {it.label}
        </button>
      {/each}
    </nav>

    {#if esEmpresa}
      <div class="inicio-panel">
        <button type="button" class="menu-item" onclick={abrirPanel}>
          {i18n.t("inicio.panel_empresa")}
        </button>
        <p class="inicio-panel-ayuda">{i18n.t("inicio.panel_empresa_ayuda")}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .inicio-panel {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 2px solid var(--c-borde);
  }
  .inicio-panel-ayuda {
    margin: 6px 2px 0;
    font-size: 13px;
    color: var(--c-texto-suave);
  }
</style>
