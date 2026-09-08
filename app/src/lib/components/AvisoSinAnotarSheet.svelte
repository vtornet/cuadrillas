<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";

  let {
    nombres,
    onseguir,
    onvolver,
  }: {
    nombres: string[];
    onseguir: () => void;
    onvolver: () => void;
  } = $props();

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onvolver();
  }
</script>

<svelte:window onkeydown={onKey} />

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={i18n.t("sin_anotar.titulo")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("sin_anotar.titulo")}</h2>
      <button
        type="button"
        class="aspa"
        onclick={onvolver}
        aria-label={i18n.t("worker.cerrar")}
      >
        &times;
      </button>
    </div>

    <div class="hoja-cuerpo">
      <p class="aviso">{i18n.t("sin_anotar.texto")}</p>
      <ul class="sin-anotar-lista">
        {#each nombres as n (n)}
          <li>{n}</li>
        {/each}
      </ul>
    </div>

    <div class="hoja-pie firma-pie">
      <button type="button" class="btn-secundario" onclick={onvolver}>
        {i18n.t("sin_anotar.volver")}
      </button>
      <button type="button" class="btn-deshacer" onclick={onseguir}>
        {i18n.t("sin_anotar.seguir")}
      </button>
    </div>
  </div>
</div>

<style>
  .sin-anotar-lista {
    margin: 10px 0 0;
    padding-inline-start: 1.3rem;
  }
  .sin-anotar-lista li {
    margin: 4px 0;
    font-weight: 600;
  }
</style>
