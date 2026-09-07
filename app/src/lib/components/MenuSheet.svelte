<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";
  import { router, type Vista } from "../stores/router.svelte";

  let { onclose }: { onclose: () => void } = $props();

  const items: Array<{ v: Vista; label: string }> = [
    { v: "registro", label: i18n.t("menu.registrar") },
    { v: "historial", label: i18n.t("menu.historial") },
    { v: "estadisticas", label: i18n.t("menu.estadisticas") },
    { v: "asistencia", label: i18n.t("menu.asistencia") },
    { v: "gestion", label: i18n.t("menu.gestion") },
    { v: "cuenta", label: i18n.t("menu.cuenta") },
    { v: "privacidad", label: i18n.t("menu.privacidad") },
  ];

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay">
  <button
    type="button"
    class="overlay-backdrop"
    aria-label={i18n.t("menu.cerrar")}
    onclick={onclose}
  ></button>
  <div
    class="hoja hoja-menu"
    role="dialog"
    aria-modal="true"
    aria-label={i18n.t("menu.titulo")}
  >
    <div class="hoja-cab">
      <h2>{i18n.t("menu.titulo")}</h2>
      <button
        type="button"
        class="aspa"
        onclick={onclose}
        aria-label={i18n.t("menu.cerrar")}
      >
        &times;
      </button>
    </div>
    <nav class="menu-lista">
      {#each items as it (it.v)}
        <button
          type="button"
          class="menu-item"
          class:activo={router.vista === it.v}
          onclick={() => router.ir(it.v)}
        >
          {it.label}
        </button>
      {/each}
    </nav>
  </div>
</div>
